import { useMemo } from 'react';
import type { IncomingTransactionWithChainId } from 'src/modules/ethereum/types/IncomingTransaction';
import { useGetOperationsToSignTransactionOrSignTypedData } from '@orb-labs/orby-react';
import type { ExternallyOwnedAccount } from 'src/shared/types/ExternallyOwnedAccount';
import type { GasTokenInput } from 'src/ui/pages/SendTransaction/NetworkFee/NetworkFee';
import { useOperationSetError } from './useOperationSetError';

export function useOrbyGetOperationsToSignTransactionOrSignTypedData(
  transaction: {
    evm?: IncomingTransactionWithChainId | undefined;
    solana?: string | undefined;
    typedData?: string | undefined;
  },
  wallet: ExternallyOwnedAccount | undefined,
  isOrbyEnabled: boolean | undefined,
  selectedGasToken: GasTokenInput | undefined,
  chainId: bigint | undefined,
  options?: Map<string, any>
) {
  const gasToken = useMemo(() => {
    return selectedGasToken?.standardizedTokenId
      ? { standardizedTokenId: selectedGasToken.standardizedTokenId }
      : undefined;
  }, [selectedGasToken]);

  const orbyParams = useMemo(() => {
    if (!isOrbyEnabled) {
      return { data: undefined as unknown as string };
    } else if (transaction.evm) {
      return {
        data: transaction.evm?.data as string,
        to: transaction.evm?.to as string,
        value: transaction.evm?.value
          ? BigInt(transaction.evm?.value?.toString())
          : undefined,
        entrypointAccountAddress: wallet?.address as string,
        chainId,
        gasToken,
      };
    } else if (transaction.solana) {
      return {
        data: transaction.solana as string,
        entrypointAccountAddress: wallet?.address as string,
        chainId,
        gasToken,
      };
    } else if (transaction.typedData) {
      return {
        data: transaction.typedData as string,
        entrypointAccountAddress: wallet?.address as string,
        chainId,
        gasToken,
      };
    } else {
      return { data: undefined as unknown as string };
    }
  }, [transaction, isOrbyEnabled, chainId, wallet, gasToken]);

  const {
    operationSet,
    isLoading: operationSetLoading,
    operations,
    virtualNode,
    aggregateFee,
  } = useGetOperationsToSignTransactionOrSignTypedData(
    orbyParams?.data,
    orbyParams?.to,
    orbyParams?.value,
    orbyParams?.entrypointAccountAddress,
    orbyParams?.chainId,
    orbyParams?.gasToken,
    options
  );

  const operationSetError = useOperationSetError(operationSet, isOrbyEnabled);

  return {
    operationSet,
    operationSetError,
    operationSetLoading,
    operations,
    virtualNode,
    aggregateFee,
  };
}
