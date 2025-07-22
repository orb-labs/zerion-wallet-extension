import { ethers } from 'ethers';

/**
 * Normalizes token addresses, handling native tokens and special cases
 * @param address - The token address to normalize
 * @returns Normalized address (ZeroAddress for native tokens, original for others)
 */
export function normalizeTokenAddress(
  address: string | null | undefined
): string {
  // Handle Solana native token and null/undefined cases
  if (
    ['11111111111111111111111111111111', null, undefined].includes(
      address as string
    )
  ) {
    return ethers.ZeroAddress;
  }

  return address as string;
}
