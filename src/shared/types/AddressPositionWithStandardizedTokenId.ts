import type { AddressPosition } from 'defi-sdk';

export interface AddressPositionWithStandardizedTokenId
  extends AddressPosition {
  standardizedTokenId?: string;
}
