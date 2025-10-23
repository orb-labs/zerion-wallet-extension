import React, { useEffect, useMemo, useRef } from 'react';
import { NavigationType, useNavigationType, useParams } from 'react-router-dom';
import { useCurrency } from 'src/modules/currency/useCurrency';
import { invariant } from 'src/shared/invariant';
import { NavigationTitle } from 'src/ui/components/NavigationTitle';
import { PageColumn } from 'src/ui/components/PageColumn';
import { StickyBottomPanel } from 'src/ui/ui-kit/BottomPanel';
import { Button } from 'src/ui/ui-kit/Button';
import { HStack } from 'src/ui/ui-kit/HStack';
import { VStack } from 'src/ui/ui-kit/VStack';
import SwapIcon from 'jsx:src/ui/assets/actions/swap.svg';
import SendIcon from 'jsx:src/ui/assets/actions/send.svg';
import BridgeIcon from 'jsx:src/ui/assets/actions/bridge.svg';
import FlagIcon from 'jsx:src/ui/assets/flag.svg';
import ShareIcon from 'jsx:src/ui/assets/share.svg';
import { UIText } from 'src/ui/ui-kit/UIText';
import { PageTop } from 'src/ui/components/PageTop';
import { useAssetFullInfo } from 'src/modules/zerion-api/hooks/useAssetFullInfo';
import type { Asset } from 'src/modules/zerion-api/requests/asset-get-fungible-full-info';
import { UnstyledAnchor } from 'src/ui/ui-kit/UnstyledAnchor';
import { useQuery } from '@tanstack/react-query';
import { walletPort } from 'src/ui/shared/channels';
import { useAddressParams } from 'src/ui/shared/user-address/useAddressParams';
import { isReadonlyAccount } from 'src/shared/types/validators';
import { useWalletAssetDetails } from 'src/modules/zerion-api/hooks/useWalletAssetDetails';
import { useBackgroundKind } from 'src/ui/components/Background';
import { UnstyledLink } from 'src/ui/ui-kit/UnstyledLink';
import { useWalletPortfolio } from 'src/modules/zerion-api/hooks/useWalletPortfolio';
import { useHttpClientSource } from 'src/modules/zerion-api/hooks/useHttpClientSource';
import { NetworkId } from 'src/modules/networks/NetworkId';
import { CircleSpinner } from 'src/ui/ui-kit/CircleSpinner';
import { whiteBackgroundKind } from 'src/ui/components/Background/Background';
import { useWalletAssetPnl } from 'src/modules/zerion-api/hooks/useWalletAssetPnl';
import { useCopyToClipboard } from 'src/ui/shared/useCopyToClipboard';
import { UnstyledButton } from 'src/ui/ui-kit/UnstyledButton';
import type { PopoverToastHandle } from 'src/ui/pages/Settings/PopoverToast';
import { PopoverToast } from 'src/ui/pages/Settings/PopoverToast';
import { useGetFungibleTokenBalances } from '@orb-labs/orby-react';
import type { StandardizedBalance } from '@orb-labs/orby-core';
import { CurrencyAmount } from '@orb-labs/orby-core';
import type { WalletAssetDetails } from 'src/modules/zerion-api/requests/wallet-get-asset-details';
import { findNetworkByChainId } from 'src/modules/networks/networks-fallback';
import { AssetHistory } from './AssetHistory';
import { AssetAddressStats } from './AssetAddressDetails';
import { AssetGlobalStats } from './AssetGlobalStats';
import { AssetTitleAndChart } from './AssetTitleAndChart';
import { AssetResources } from './AssetResources';
import {
  AssetDefaultHeader,
  AssetHeader as AssetScrolledHeader,
} from './AssetHeader';
import { AssetDescription } from './AssetDescription';
import * as styles from './styles.module.css';

/**
 * Converts tokensInfo (StandardizedBalance) into walletAssetDetails format,
 * using walletData to fill missing data from tokensInfo
 */
function convertTokensInfoToWalletAssetDetails(
  tokensInfo: StandardizedBalance | undefined,
  walletData: WalletAssetDetails | undefined
): WalletAssetDetails | undefined {
  if (!tokensInfo) {
    return walletData;
  }

  if (!walletData) {
    // If no walletData, create a minimal structure from tokensInfo
    const totalValue = Number(tokensInfo.totalValueInFiat?.toExact()) || 0;
    const totalConvertedQuantity = Number(
      tokensInfo.total.toRawAmount().toString()
    );

    return {
      chainsDistribution: null,
      issuersDistribution: null,
      tokenBalancesOnChainsDistribution: null,
      wallets: [],
      apps: null,
      totalValue,
      totalConvertedQuantity,
    };
  }

  // Use walletData as base and enhance with tokensInfo data
  const enhancedWalletData: WalletAssetDetails = {
    ...walletData,
    // Update total values with tokensInfo data if available
    totalValue:
      Number(tokensInfo.totalValueInFiat?.toExact()) || walletData.totalValue,
    totalConvertedQuantity:
      Number(tokensInfo.total.toRawAmount().toString()) ||
      walletData.totalConvertedQuantity,
  };

  enhancedWalletData.chainsDistribution = tokensInfo.tokenBalancesOnChains
    .map((tokenBalance) => {
      const chainId = tokenBalance.token.chainId.toString();

      // Find the network config using the helper function
      const networkConfig = findNetworkByChainId(chainId);

      return {
        chain: {
          id: networkConfig?.id || chainId,
          name: networkConfig?.name || `Chain ${chainId}`,
          iconUrl: networkConfig?.icon_url || '',
          testnet: networkConfig?.is_testnet || false,
        },
        value: Number(tokenBalance.toExact()) || 0,
        percentageAllocation:
          tokensInfo.total.toRawAmount() === BigInt(0)
            ? 0
            : (100 * Number(tokenBalance.toExact())) /
              Number(tokensInfo.total.toExact()),
      };
    })
    .sort((a, b) => b.percentageAllocation - a.percentageAllocation);

  const sumByIssuer = tokensInfo.tokenBalancesOnChains.reduce(
    (acc, tokenBalance) => {
      const currency = tokenBalance.token.currency();
      let amount = tokenBalance.toRawAmount();
      const existing = acc.get(currency.symbol);
      if (existing) {
        amount += existing.toRawAmount();
      }

      acc.set(currency.symbol, CurrencyAmount.fromRawAmount(currency, amount));

      return acc;
    },
    new Map<string, CurrencyAmount>()
  );

  enhancedWalletData.issuersDistribution = Array.from(sumByIssuer.entries())
    .map(([_, amount]) => {
      return {
        issuer: amount.currency,
        value: Number(amount.toExact()) || 0,
        percentageAllocation:
          (Number(amount.toExact()) / Number(tokensInfo.total.toExact())) * 100,
      };
    })
    .sort((a, b) => b.percentageAllocation - a.percentageAllocation);

  enhancedWalletData.tokenBalancesOnChainsDistribution =
    tokensInfo.tokenBalancesOnChains
      .map((tokenBalance) => {
        return {
          tokenBalance: tokenBalance,
          value: Number(tokenBalance.toExact()) || 0,
          percentageAllocation:
            (Number(tokenBalance.toExact()) /
              Number(tokensInfo.total.toExact())) *
            100,
        };
      })
      .sort((a, b) => b.percentageAllocation - a.percentageAllocation);

  return enhancedWalletData;
}

function ReportAssetLink({ asset }: { asset: Asset }) {
  return (
    <UnstyledAnchor
      target="_blank"
      href={`https://zerion-io.typeform.com/to/IVsRHfBy?typeform-medium=embed-snippet#symbol=${asset.symbol}&asset_id=${asset.id}`}
      rel="noopener noreferrer"
      className="parent-hover"
      style={{
        ['--parent-content-color' as string]: 'var(--neutral-400)',
        ['--parent-hovered-content-color' as string]: 'var(--neutral-700)',
      }}
    >
      <HStack
        gap={8}
        alignItems="center"
        className="content-hover"
        justifyContent="center"
      >
        <FlagIcon style={{ width: 20, height: 20 }} />
        <UIText kind="small/accent">Report Asset</UIText>
      </HStack>
    </UnstyledAnchor>
  );
}

function ShareAssetLink({ asset }: { asset: Asset }) {
  const toastRef = useRef<PopoverToastHandle>(null);
  const { handleCopy } = useCopyToClipboard({
    text: `https://app.zerion.io/tokens/${asset.symbol}-${asset.id}`,
    onSuccess: () => toastRef.current?.showToast(),
  });

  return (
    <>
      <PopoverToast
        ref={toastRef}
        style={{
          bottom: 'calc(100px + var(--technical-panel-bottom-height, 0px))',
        }}
      >
        Link Copied to Clipboard
      </PopoverToast>
      <UnstyledButton
        onClick={handleCopy}
        title="Copy Link"
        aria-label="Copy Link"
      >
        <ShareIcon />
      </UnstyledButton>
    </>
  );
}

export function AssetInfo() {
  const { asset_code, standardizedTokenId } = useParams();
  invariant(asset_code, 'Asset Code is required');
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType === NavigationType.Push) {
      window.scrollTo(0, 0);
    }
  }, [navigationType]);
  useBackgroundKind(whiteBackgroundKind);

  const standardizeChainId = useMemo(() => {
    return standardizedTokenId ? [standardizedTokenId] : undefined;
  }, [standardizedTokenId]);

  const { fungibleTokenBalances, isLoading: isLoadingFungibleTokenBalances } =
    useGetFungibleTokenBalances(
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      standardizeChainId
    );

  const { currency } = useCurrency();
  const { data: assetFullInfoData, isLoading } = useAssetFullInfo(
    { currency, fungibleId: asset_code },
    { source: useHttpClientSource() }
  );

  const { ready, params } = useAddressParams();
  const { data: portfolioData } = useWalletPortfolio(
    {
      addresses: [params.address],
      currency,
      nftPriceType: 'not_included',
    },
    { source: useHttpClientSource() },
    { enabled: ready }
  );
  const { data: walletData } = useWalletAssetDetails(
    {
      assetId: asset_code,
      currency,
      groupBy: ['by-app'],
      addresses: [params.address],
    },
    { source: useHttpClientSource() },
    { enabled: ready }
  );

  const assetAddressPnlQuery = useWalletAssetPnl(
    {
      addresses: [params.address],
      fungibleId: asset_code,
      currency,
    },
    { source: useHttpClientSource() },
    { enabled: ready }
  );

  const { data: wallet } = useQuery({
    queryKey: ['wallet/uiGetCurrentWallet'],
    queryFn: () => {
      return walletPort.request('uiGetCurrentWallet');
    },
  });

  const tokensInfo = useMemo(() => {
    return fungibleTokenBalances?.find(
      (balance) => balance.standardizedTokenId === standardizedTokenId
    );
  }, [fungibleTokenBalances, standardizedTokenId]);

  // Convert tokensInfo to walletAssetDetails format
  const convertedWalletAssetDetails = useMemo(() => {
    return convertTokensInfoToWalletAssetDetails(tokensInfo, walletData?.data);
  }, [tokensInfo, walletData?.data]);

  const chainWithTheBiggestBalance =
    convertedWalletAssetDetails?.chainsDistribution?.at(0)?.chain.id ||
    NetworkId.Zero;

  const assetFullInfo = useMemo(() => {
    if (!assetFullInfoData?.data) {
      return undefined;
    }

    return {
      ...assetFullInfoData.data,
      fungible: {
        ...assetFullInfoData.data.fungible,
        iconUrl:
          tokensInfo?.total.currency.logoUrl ??
          assetFullInfoData.data.fungible.iconUrl,
        name:
          tokensInfo?.total.currency.name ??
          assetFullInfoData.data.fungible.name,
        symbol:
          tokensInfo?.total.currency.symbol ??
          assetFullInfoData.data.fungible.symbol,
      },
    };
  }, [assetFullInfoData, tokensInfo]);

  // Early return check moved after all hooks
  if (
    isLoading ||
    !wallet ||
    !convertedWalletAssetDetails ||
    isLoadingFungibleTokenBalances
  ) {
    return (
      <>
        <NavigationTitle title={null} documentTitle={`${asset_code} - info`} />
        <PageColumn style={{ alignItems: 'center', justifyContent: 'center' }}>
          <CircleSpinner />
        </PageColumn>
      </>
    );
  }

  invariant(assetFullInfo?.fungible, 'Fungible asset info is missing');

  const isWatchedAddress = isReadonlyAccount(wallet);
  const isEmptyBalance = convertedWalletAssetDetails.totalValue === 0;

  const chainForSwap = isEmptyBalance
    ? assetFullInfo.extra.mainChain
    : chainWithTheBiggestBalance;

  return (
    <PageColumn>
      <NavigationTitle
        title={
          <div className={styles.headerContainer}>
            <AssetDefaultHeader
              asset={assetFullInfo.fungible}
              className={styles.defaultHeader}
            />
            <AssetScrolledHeader
              asset={assetFullInfo.fungible}
              className={styles.header}
            />
          </div>
        }
        documentTitle={`${assetFullInfo.fungible.name} - info`}
        elementEnd={<ShareAssetLink asset={assetFullInfo.fungible} />}
      />
      <PageTop />
      <VStack
        gap={24}
        style={{ flexGrow: 1, alignContent: 'start', paddingBottom: 72 }}
      >
        <AssetTitleAndChart
          asset={assetFullInfo.fungible}
          address={params.address}
        />
        <AssetGlobalStats assetFullInfo={assetFullInfo} />
        <AssetAddressStats
          address={params.address}
          wallet={wallet}
          assetFullInfo={assetFullInfo}
          walletAssetDetails={convertedWalletAssetDetails}
          assetAddressPnlQuery={assetAddressPnlQuery}
        />
        <AssetResources assetFullInfo={assetFullInfo} />
        <AssetDescription assetFullInfo={assetFullInfo} />
        <AssetHistory
          assetId={asset_code}
          assetFullInfo={assetFullInfo}
          address={params.address}
        />
        <ReportAssetLink asset={assetFullInfo.fungible} />
      </VStack>
      {isWatchedAddress || !portfolioData ? null : (
        <StickyBottomPanel
          style={{ padding: 0, background: 'none', boxShadow: 'none' }}
          backdropStyle={{ inset: '-16px -16px 0' }}
        >
          <HStack
            gap={8}
            style={{
              width: '100%',
              gridTemplateColumns: isEmptyBalance ? '1fr' : '1fr auto auto',
            }}
          >
            <Button
              kind="primary"
              size={48}
              as={UnstyledLink}
              to={
                isEmptyBalance
                  ? `/swap-form?inputChain=${chainForSwap}&outputFungibleId=${asset_code}&standardizedTokenId=${standardizedTokenId}`
                  : `/swap-form?inputChain=${chainForSwap}&inputFungibleId=${asset_code}&standardizedTokenId=${standardizedTokenId}`
              }
            >
              <HStack gap={8} alignItems="center" justifyContent="center">
                <SwapIcon style={{ width: 20, height: 20 }} />
                <UIText kind="body/accent">Swap</UIText>
              </HStack>
            </Button>
            {isEmptyBalance ? null : (
              <>
                <Button
                  as={UnstyledLink}
                  kind="primary"
                  size={48}
                  to={`/send-form?tokenAssetCode=${asset_code}&tokenChain=${chainWithTheBiggestBalance}&standardizedTokenId=${standardizedTokenId}`}
                  style={{ padding: 14 }}
                  aria-label="Send Token"
                >
                  <SendIcon style={{ width: 20, height: 20 }} />
                </Button>
                <Button
                  kind="primary"
                  as={UnstyledLink}
                  to={`/bridge-form?inputFungibleId=${asset_code}&inputChain=${chainWithTheBiggestBalance}&standardizedTokenId=${standardizedTokenId}`}
                  size={48}
                  style={{ padding: 14 }}
                  aria-label="Bridge Token"
                >
                  <BridgeIcon style={{ width: 20, height: 20 }} />
                </Button>
              </>
            )}
          </HStack>
        </StickyBottomPanel>
      )}
    </PageColumn>
  );
}
