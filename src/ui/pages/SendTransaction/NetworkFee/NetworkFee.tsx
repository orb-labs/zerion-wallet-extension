import { isTruthy } from 'is-truthy-ts';
import React, { useRef } from 'react';
import type { NetworkFeeConfiguration } from '@zeriontech/transactions';
import type { ChainGasPrice } from 'src/modules/ethereum/transactions/gasPrices/types';
import { CircleSpinner } from 'src/ui/ui-kit/CircleSpinner';
import { HStack } from 'src/ui/ui-kit/HStack';
import { UIText } from 'src/ui/ui-kit/UIText';
import { formatTokenValue } from 'src/shared/units/formatTokenValue';
import { noValueDash } from 'src/ui/shared/typography';
import * as helperStyles from 'src/ui/style/helpers.module.css';
import { UnstyledButton } from 'src/ui/ui-kit/UnstyledButton';
import type { HTMLDialogElementInterface } from 'src/ui/ui-kit/ModalDialogs/HTMLDialogElementInterface';
import type { Chain } from 'src/modules/networks/Chain';
import type { IncomingTransactionWithFrom } from 'src/modules/ethereum/types/IncomingTransaction';
import { useNetworks } from 'src/modules/networks/useNetworks';
import { useCurrency } from 'src/modules/currency/useCurrency';
import { formatCurrencyValueExtra } from 'src/shared/units/formatCurrencyValue';
import type { StandardizedBalance } from '@orb-labs/orby-core';
import { TokenIcon } from 'src/ui/ui-kit/TokenIcon';
import { BottomSheetDialog } from 'src/ui/ui-kit/ModalDialogs/BottomSheetDialog';
import { DialogTitle } from 'src/ui/ui-kit/ModalDialogs/DialogTitle';
import { SurfaceList } from 'src/ui/ui-kit/SurfaceList';
import { VStack } from 'src/ui/ui-kit/VStack';
import { createPortal } from 'react-dom';
import { getRootDomNode } from 'src/ui/shared/getRootDomNode';
import DownIcon from 'jsx:src/ui/assets/chevron-down.svg';
import { useIsOrbyEnabled } from 'src/shared/core/useIsOrbyEnabled';
import type { TransactionFee } from '../TransactionConfiguration/useTransactionFee';
import { NETWORK_SPEED_TO_TITLE } from './constants';
import { NetworkFeeDialog } from './NetworkFeeDialog';

export interface GasTokenInput {
  name: string;
  standardizedTokenId?: string;
  isDefault: boolean;
  url?: string;
}

function getFeeTypeTitle(
  type: Exclude<keyof ChainGasPrice['fast'], 'eta'> | undefined
) {
  if (!type) {
    return undefined;
  }
  if (type === 'classic') {
    return undefined;
  }
  const labels = { eip1559: 'EIP-1559', optimistic: 'Optimistic' } as const;
  return labels[type];
}

export function GasTokenSelector({
  selectedGasToken,
  setSelectedGasToken,
  fungibleTokens,
}: {
  selectedGasToken?: GasTokenInput;
  setSelectedGasToken?: (gasToken?: GasTokenInput) => void;
  fungibleTokens?: StandardizedBalance[] | undefined;
}) {
  const dialogRef = useRef<HTMLDialogElementInterface | null>(null);
  const rootNode = getRootDomNode();

  const handleSelectGasToken = (token: StandardizedBalance) => {
    const gasToken: GasTokenInput = {
      name: token.total.currency.symbol,
      standardizedTokenId: token.standardizedTokenId,
      isDefault: false,
      url: token.total.currency.logoUrl,
    };
    setSelectedGasToken?.(gasToken);
    dialogRef.current?.close();
  };

  const handleSelectDefault = () => {
    setSelectedGasToken?.({
      name: 'Native Token',
      standardizedTokenId: undefined,
      isDefault: true,
    });
    dialogRef.current?.close();
  };

  const items = [
    {
      key: 'default',
      component: (
        <HStack gap={8} alignItems="center">
          <TokenIcon
            size={20}
            src={undefined}
            symbol="No Gas Abstraction"
            title="No Gas Abstraction"
          />
          <UIText kind="body/regular">No Gas Abstraction</UIText>
        </HStack>
      ),
      onClick: handleSelectDefault,
      isInteractive: true,
    },
    ...(fungibleTokens
      ? fungibleTokens.map((token, index) => ({
          key: token.standardizedTokenId || `token-${index}`,
          component: (
            <HStack gap={8} alignItems="center">
              <TokenIcon
                size={20}
                src={token.total.currency.logoUrl}
                symbol={token.total.currency.symbol}
                title={token.total.currency.symbol}
              />
              <UIText kind="body/regular">{token.total.currency.symbol}</UIText>
            </HStack>
          ),
          onClick: () => handleSelectGasToken(token),
          isInteractive: true,
        }))
      : []),
  ];

  return (
    <>
      {createPortal(
        <BottomSheetDialog
          ref={dialogRef}
          height="70vh"
          containerStyle={{ paddingTop: 16 }}
        >
          <DialogTitle
            title={<UIText kind="headline/h3">Select Gas Token</UIText>}
            alignTitle="start"
          />
          <VStack gap={8} style={{ marginTop: 16 }}>
            <SurfaceList items={items} />
          </VStack>
        </BottomSheetDialog>,
        rootNode
      )}

      <UnstyledButton
        type="button"
        className={helperStyles.hoverUnderline}
        style={{
          color: 'var(--primary)',
          cursor: 'pointer',
        }}
        onClick={() => {
          dialogRef.current?.showModal();
        }}
      >
        <HStack gap={8} alignItems="center">
          <TokenIcon
            size={16}
            src={selectedGasToken?.url}
            symbol={selectedGasToken?.name || 'TOKEN'}
            title={selectedGasToken?.name}
          />
          <UIText kind="small/accent">
            {selectedGasToken?.name || 'Select Token'}
          </UIText>
          <DownIcon
            width={16}
            height={16}
            style={{
              color: 'var(--primary)',
            }}
          />
        </HStack>
      </UnstyledButton>
    </>
  );
}

export function NetworkFee({
  transaction,
  transactionFee,
  chain,
  networkFeeConfiguration,
  chainGasPrices,
  customViewOnly,
  onChange,
  label,
  renderDisplayValue,
  displayValueEnd,
  selectedGasToken,
  setSelectedGasToken,
  fungibleTokens,
}: {
  transaction: IncomingTransactionWithFrom;
  transactionFee: TransactionFee;
  chain: Chain;
  networkFeeConfiguration: NetworkFeeConfiguration;
  chainGasPrices: ChainGasPrice | null;
  onChange: null | ((value: NetworkFeeConfiguration) => void);
  customViewOnly?: boolean;
  label?: React.ReactNode;
  renderDisplayValue?: (params: {
    hintTitle: string;
    displayValue: string;
  }) => React.ReactNode;
  displayValueEnd?: React.ReactNode;
  selectedGasToken?: GasTokenInput;
  setSelectedGasToken?: (gasToken?: GasTokenInput) => void;
  fungibleTokens?: StandardizedBalance[] | undefined;
}) {
  const { networks } = useNetworks();
  const { currency } = useCurrency();
  const isOrbyEnabled = useIsOrbyEnabled(
    transaction.chainId ? BigInt(transaction.chainId) : undefined
  );
  const dialogRef = useRef<HTMLDialogElementInterface | null>(null);
  const { time, feeEstimation, feeEstimationQuery, costs, costsQuery } =
    transactionFee;
  const {
    feeValueCommon: expectedFeeValueCommon,
    maxFeeValueCommon,
    relevantFeeValueFiat: feeValueFiat,
    relevantFeeValueCommon: feeValueCommon,
    totalValueExceedsBalance,
  } = costs || {};

  const isLoading = feeEstimationQuery.isLoading || costsQuery.isLoading;

  const nativeAssetSymbol =
    networks?.getNetworkByName(chain)?.native_asset?.symbol;

  const disabled = isLoading || !onChange;

  const feeValuePrefix = totalValueExceedsBalance ? 'Up to ' : '';
  const feeValueFormatted = feeValueFiat
    ? formatCurrencyValueExtra(feeValueFiat, 'en', currency, {
        zeroRoundingFallback: 0.01,
      })
    : feeValueCommon
    ? formatTokenValue(feeValueCommon.toString(), nativeAssetSymbol)
    : undefined;

  const hintTitle = [
    getFeeTypeTitle(feeEstimation?.type),
    expectedFeeValueCommon
      ? `${totalValueExceedsBalance ? 'Expected Fee: ' : ''}${formatTokenValue(
          expectedFeeValueCommon,
          nativeAssetSymbol
        )}`
      : null,
    totalValueExceedsBalance && maxFeeValueCommon
      ? `Max Fee: ${formatTokenValue(maxFeeValueCommon, nativeAssetSymbol)}`
      : null,
  ]
    .filter(isTruthy)
    .join(' · ');

  const displayValue = feeValueFormatted
    ? [
        networkFeeConfiguration.speed === 'custom' && time ? time : null,
        networkFeeConfiguration.speed === 'custom'
          ? NETWORK_SPEED_TO_TITLE.custom
          : time || NETWORK_SPEED_TO_TITLE[networkFeeConfiguration.speed],
        `${feeValuePrefix}${feeValueFormatted}`,
      ]
        .filter(isTruthy)
        .join(' · ')
    : null;

  return (
    <>
      {onChange ? (
        <NetworkFeeDialog
          ref={dialogRef}
          value={networkFeeConfiguration}
          onSubmit={(value) => {
            onChange(value);
          }}
          onDismiss={() => {
            dialogRef.current?.close();
          }}
          chain={chain}
          chainGasPrices={chainGasPrices}
          transaction={transaction}
          customViewOnly={customViewOnly}
        />
      ) : null}
      <HStack gap={8} justifyContent="space-between">
        {label !== undefined ? (
          label
        ) : (
          <UIText kind="small/regular">Network Fee</UIText>
        )}
        {selectedGasToken && isOrbyEnabled ? (
          <GasTokenSelector
            selectedGasToken={selectedGasToken}
            setSelectedGasToken={setSelectedGasToken}
            fungibleTokens={fungibleTokens}
          />
        ) : null}
        {isLoading ? (
          <CircleSpinner />
        ) : displayValue ? (
          <HStack gap={0} alignItems="center">
            <HStack gap={12} alignItems="center">
              {feeEstimationQuery.isPreviousData ? <CircleSpinner /> : null}
              <UnstyledButton
                type="button"
                className={disabled ? undefined : helperStyles.hoverUnderline}
                style={{
                  color: disabled ? 'var(--black)' : 'var(--primary)',
                  cursor: !onChange ? 'auto' : undefined,
                }}
                onClick={() => {
                  dialogRef.current?.showModal();
                }}
                disabled={disabled}
              >
                {renderDisplayValue?.({ hintTitle, displayValue }) ?? (
                  <UIText kind="small/accent" title={hintTitle}>
                    {displayValue}
                    {displayValueEnd ? ' · ' : null}
                  </UIText>
                )}
              </UnstyledButton>
            </HStack>
            {displayValueEnd}
          </HStack>
        ) : feeEstimationQuery.isSuccess ? (
          <UIText kind="small/regular" title="No fee data">
            {noValueDash}
          </UIText>
        ) : null}
      </HStack>
    </>
  );
}
