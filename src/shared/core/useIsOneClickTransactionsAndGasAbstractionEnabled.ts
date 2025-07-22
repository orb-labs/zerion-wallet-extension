import { useRemoteConfigValue } from 'src/modules/remote-config/useRemoteConfigValue';

export function useIsOneClickTransactionsAndGasAbstractionEnabled() {
  const { data: oneClickTransactionsAndGasAbstraction } = useRemoteConfigValue(
    'one_click_transactions_and_gas_abstraction'
  );

  return oneClickTransactionsAndGasAbstraction;
}
