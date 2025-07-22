import { type StandardizedBalance } from '@orb-labs/orby-core';
import { createChainAddressKey } from './createChainAddressKey';

/**
 * Creates a map of {chainId}+{address} to StandardizedBalance from fungible tokens
 * @param fungibleTokens - Array of StandardizedBalance objects from Orby
 * @returns Map where key is "{chainId}+{address}" and value is the corresponding StandardizedBalance
 */
export function createChainAddressToStandardizedBalanceMap(
  fungibleTokens: StandardizedBalance[] | undefined
): Map<string, StandardizedBalance> {
  const map = new Map<string, StandardizedBalance>();

  if (!fungibleTokens || fungibleTokens.length === 0) {
    return map;
  }

  for (const standardizedBalance of fungibleTokens) {
    if (!standardizedBalance.tokenBalancesOnChains?.length) {
      continue;
    }

    for (const tokenBalance of standardizedBalance.tokenBalancesOnChains) {
      const chainId = tokenBalance.token.chainId.toString();
      const address = tokenBalance.token.address;
      const key = createChainAddressKey(chainId, address);
      map.set(key, standardizedBalance);
    }
  }

  return map;
}
