import { createChain } from 'src/modules/networks/Chain';
import type { StandardizedBalance } from '@orb-labs/orby-core';
import type { Networks } from 'src/modules/networks/Networks';
import type { AddressPositionWithStandardizedTokenId } from '../types/AddressPositionWithStandardizedTokenId';
import { createTokenImplementations } from './createTokenImplementations';
import { calculateStandardizedQuantity } from './calculateStandardizedQuantity';
import { createChainAddressKey } from './createChainAddressKey';
import { normalizeTokenAddress } from './normalizeTokenAddress';

interface ProcessUnifiedPositionsParams {
  positions: AddressPositionWithStandardizedTokenId[] | undefined;
  chainAddressToStandardizedBalanceMap: Map<string, StandardizedBalance>;
  networks?: Networks | undefined;
}

/**
 * Processes positions data by filtering and transforming using StandardizedBalance data
 * @param params - Object containing positions data and mapping
 * @returns Filtered and processed positions array
 */
export function processUnifiedPositions({
  positions,
  chainAddressToStandardizedBalanceMap,
  networks,
}: ProcessUnifiedPositionsParams):
  | AddressPositionWithStandardizedTokenId[]
  | undefined {
  const seenStandardizedTokenIds = new Set<string>();

  return positions?.filter((position) => {
    const asset = position.asset;
    const chainName = position.chain;

    const assetImplementation = asset?.implementations?.[chainName];
    const address = normalizeTokenAddress(assetImplementation?.address);

    const chain = createChain(chainName);
    const chainId =
      chain?.value == 'solana'
        ? 101
        : chain?.value && networks
        ? networks.getChainId(chain)
        : null;

    if (!chainId) {
      return false;
    }

    const key = createChainAddressKey(chainId, address as string);
    const standardizedBalance = chainAddressToStandardizedBalanceMap.get(key);

    // Create a unique key for this position
    const positionKey = standardizedBalance?.standardizedTokenId as string;

    // If we've already seen this standardized token ID, skip it
    if (seenStandardizedTokenIds.has(positionKey)) {
      return false;
    }

    // Mark this standardized token ID as seen
    seenStandardizedTokenIds.add(positionKey);

    // Update position with standardized balance data
    if (standardizedBalance) {
      position.standardizedTokenId = standardizedBalance.standardizedTokenId;
      position.quantity = calculateStandardizedQuantity({
        standardizedBalance,
        assetImplementationDecimals: assetImplementation?.decimals,
      });

      position.value = standardizedBalance?.totalValueInFiat?.toExact() || null;
      position.asset.implementations =
        createTokenImplementations(standardizedBalance);
    }

    return true;
  });
}
