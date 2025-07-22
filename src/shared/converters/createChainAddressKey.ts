import { validateAndFormatAddress } from '@orb-labs/orby-core';

/**
 * Creates a key string from chainId and address for mapping purposes
 * @param chainId - The chain ID (can be number, string, or bigint)
 * @param address - The token address
 * @returns Formatted key string in format "{chainId}+{address}"
 */
export function createChainAddressKey(
  chainId: number | string | bigint,
  address: string
): string {
  return `${BigInt(chainId).toString()}+${validateAndFormatAddress(address)}`;
}
