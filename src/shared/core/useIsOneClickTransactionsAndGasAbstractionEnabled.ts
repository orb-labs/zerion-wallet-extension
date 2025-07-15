import { useRemoteConfigValue } from 'src/modules/remote-config/useRemoteConfigValue';
import { useMemo } from 'react';
import _ from 'lodash';

export function useIsOneClickTransactionsAndGasAbstractionEnabled() {
  const { data: oneClickTransactionsAndGasAbstraction } = useRemoteConfigValue(
    'one_click_transactions_and_gas_abstraction'
  );

  return useMemo(() => {
    // TODO: make oneClickTransactionsAndGasAbstraction default to false when it has been
    // properly setup with the remote system
    return (
      (!_.isUndefined(oneClickTransactionsAndGasAbstraction) &&
        oneClickTransactionsAndGasAbstraction) ||
      true
    );
  }, [oneClickTransactionsAndGasAbstraction]);
}
