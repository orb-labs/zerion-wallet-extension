import { findNetworkByChainId } from 'src/modules/networks/networks-fallback';
import type { StandardizedBalance } from '@orb-labs/orby-core';

/**
 * Creates token implementations object from StandardizedBalance tokenBalancesOnChains
 * @param standardizedBalance - StandardizedBalance object from Orby
 * @returns Object with chain names as keys and token implementation details as values
 */
export function createTokenImplementations(
  standardizedBalance: StandardizedBalance
): Record<string, { address: string; decimals: number }> {
  return standardizedBalance.tokenBalancesOnChains.reduce(
    (acc, tokenBalance) => {
      // Find the network config to get the chain name used in Zerion app
      const networkConfig = findNetworkByChainId(
        tokenBalance.token.chainId.toString()
      );
      const chainName =
        networkConfig?.id || tokenBalance.token.chainId.toString();

      return {
        ...acc,
        [chainName]: {
          address: tokenBalance.token.address,
          decimals: tokenBalance.token.decimals,
        },
      };
    },
    {}
  );
}
