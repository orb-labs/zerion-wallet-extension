import { ethers } from 'ethers';
import type { AddressPosition } from 'defi-sdk';
import type { StandardizedBalance } from '@orb-labs/orby-core';
import { NetworkSelectValue } from 'src/modules/networks/NetworkSelectValue';
import { findNetworkByChainId } from 'src/modules/networks/networks-fallback';
import type { Chain } from 'src/modules/networks/Chain';
import { createTokenImplementations } from './createTokenImplementations';
import { calculateStandardizedQuantity } from './calculateStandardizedQuantity';

/**
 * Gets the Zerion asset ID for native tokens based on chain ID
 * @param chainId - The chain ID as a bigint
 * @returns The asset ID string
 */
function getNativeTokenAssetId(chainId: bigint): string {
  const chainIdStr = chainId.toString();

  // Find the network config using the helper function
  const networkConfig = findNetworkByChainId(chainIdStr);

  if (networkConfig?.native_asset?.id) {
    return networkConfig.native_asset.id;
  }

  // Fallback for unknown chains
  return `chain-${chainId}`;
}

/**
 * Converts fungibleTokens (StandardizedBalance[]) into AddressPosition[] format
 * to match the structure expected by the positions components
 *
 * @param fungibleTokens - Array of StandardizedBalance objects from Orby
 * @returns Array of AddressPosition objects compatible with existing UI components
 */
export function convertFungibleTokensToAddressPositions(
  fungibleTokens: StandardizedBalance[] | undefined,
  entryPointChain?: Chain,
  entryPointChainId?: bigint
): AddressPosition[] {
  if (!fungibleTokens || fungibleTokens?.length === 0) {
    return [];
  }

  return fungibleTokens.map((standardizedBalance) => {
    // Based on GasTokenSelector usage, we access token.total.currency and token.total.amount
    const currencyInfo = standardizedBalance.total.currency;
    const quantity = calculateStandardizedQuantity({
      standardizedBalance,
      assetImplementationDecimals: 0,
    });

    // Find the token balance with the biggest value or the one matching entryPointChainId
    const firstTokenBalance = (() => {
      if (!standardizedBalance.tokenBalancesOnChains?.length) {
        return standardizedBalance.tokenBalancesOnChains?.[0];
      }

      // First, try to find the one matching entryPointChainId
      const matchingChain = standardizedBalance.tokenBalancesOnChains.find(
        (tokenBalance) => tokenBalance.token.chainId === entryPointChainId
      );

      if (matchingChain) {
        return matchingChain;
      }

      // If no match found, find the one with the biggest value
      const sortedByValue = [...standardizedBalance.tokenBalancesOnChains].sort(
        (a, b) => Number(b.toExact()) - Number(a.toExact())
      );

      return sortedByValue[0];
    })();

    // Handle native tokens (zero address) and other tokens
    const isNativeToken =
      firstTokenBalance?.token.address === ethers.ZeroAddress;
    const assetId = isNativeToken
      ? getNativeTokenAssetId(firstTokenBalance?.token.chainId ?? BigInt(1))
      : firstTokenBalance?.token.address ?? '';

    return {
      standardizedTokenId: standardizedBalance.standardizedTokenId,
      id: standardizedBalance.standardizedTokenId,
      chain: entryPointChain?.value ?? NetworkSelectValue.Unified,
      value: standardizedBalance?.totalValueInFiat?.toExact() || null,
      apy: null,
      included_in_chart: false,
      name: 'Asset',
      quantity,
      protocol: null,
      dapp: null,
      type: 'asset' as const,
      is_displayable: true,
      asset: {
        is_displayable: true,
        type: null,
        name: currencyInfo.name,
        symbol: currencyInfo.symbol,
        id: assetId,
        asset_code: firstTokenBalance?.token?.address ?? '',
        decimals: currencyInfo.decimals,
        icon_url: currencyInfo.logoUrl || null,
        is_verified: true,
        price: null, // Price information not available in StandardizedBalance
        implementations: createTokenImplementations(standardizedBalance),
      },
      parent_id: null,
    };
  });
}
