import { useIsOrbySupportedChain } from '@orb-labs/orby-react';
import { useMemo } from 'react';
import _ from 'lodash';
import { useIsOneClickTransactionsAndGasAbstractionEnabled } from './useIsOneClickTransactionsAndGasAbstractionEnabled';

export function useIsOrbyEnabled(chainId?: bigint | undefined) {
  const oneClickTransactionsAndGasAbstractionEnabled =
    useIsOneClickTransactionsAndGasAbstractionEnabled();

  const { isSupported } = useIsOrbySupportedChain(chainId);

  return useMemo(() => {
    return oneClickTransactionsAndGasAbstractionEnabled && isSupported;
  }, [oneClickTransactionsAndGasAbstractionEnabled, isSupported]);
}
