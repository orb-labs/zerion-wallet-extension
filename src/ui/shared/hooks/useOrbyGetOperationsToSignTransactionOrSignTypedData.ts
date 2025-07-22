import { useMemo } from 'react';
import type { IncomingTransactionWithChainId } from 'src/modules/ethereum/types/IncomingTransaction';
import { useGetOperationsToSignTransactionOrSignTypedData } from '@orb-labs/orby-react';
import type { ExternallyOwnedAccount } from 'src/shared/types/ExternallyOwnedAccount';
import type { GasTokenInput } from 'src/ui/pages/SendTransaction/NetworkFee/NetworkFee';
import { useOperationSetError } from './useOperationSetError';

export function useOrbyGetOperationsToSignTransactionOrSignTypedData(
  populatedTransaction: IncomingTransactionWithChainId | undefined,
  wallet: ExternallyOwnedAccount,
  isOrbyEnabled: boolean | undefined,
  selectedGasToken: GasTokenInput | undefined
) {
  const gasToken = useMemo(() => {
    return selectedGasToken?.standardizedTokenId
      ? { standardizedTokenId: selectedGasToken.standardizedTokenId }
      : undefined;
  }, [selectedGasToken]);

  const { operationSet, isLoading: operationSetLoading } =
    useGetOperationsToSignTransactionOrSignTypedData(
      populatedTransaction?.data as string,
      populatedTransaction?.to as string,
      populatedTransaction?.value
        ? BigInt(populatedTransaction?.value.toString())
        : undefined,
      isOrbyEnabled ? (wallet?.address as string) : undefined,
      isOrbyEnabled && populatedTransaction?.chainId
        ? BigInt(populatedTransaction?.chainId as number)
        : undefined,
      gasToken
    );

  const operationSetError = useOperationSetError(operationSet, isOrbyEnabled);

  return { operationSet, operationSetError, operationSetLoading };
}
