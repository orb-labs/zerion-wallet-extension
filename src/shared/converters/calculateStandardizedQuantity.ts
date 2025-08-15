import { BigNumber } from 'bignumber.js';
import type { StandardizedBalance } from '@orb-labs/orby-core';

interface CalculateStandardizedQuantityParams {
  standardizedBalance: StandardizedBalance;
  assetImplementationDecimals?: number;
}

/**
 * Calculates the quantity for a position from StandardizedBalance data
 * @param params - Object containing StandardizedBalance and optional decimals
 * @returns Formatted quantity string
 */
export function calculateStandardizedQuantity({
  standardizedBalance,
  assetImplementationDecimals = 0,
}: CalculateStandardizedQuantityParams): string {
  return new BigNumber(standardizedBalance.total.toRawAmount().toString())
    .shiftedBy(assetImplementationDecimals)
    .shiftedBy(0 - standardizedBalance?.total?.currency?.decimals)
    .toString();
}
