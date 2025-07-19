import { useEffect, useState } from 'react';
import { CreateOperationsStatus } from '@orb-labs/orby-core';
import type { OperationSet } from '@orb-labs/orby-core';

/**
 * Custom hook that monitors operation set status and returns appropriate error messages
 * @param operationSet - The operation set to monitor
 * @param isOrbyEnabled - Whether Orby is enabled for the current chain
 * @returns The error message string or null if no error
 */
export function useOperationSetError(
  operationSet: OperationSet | undefined,
  isOrbyEnabled: boolean
): string | null {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (operationSet?.status && isOrbyEnabled) {
      let newErrorMessage: string | null = null;

      if (operationSet.status === CreateOperationsStatus.INSUFFICIENT_FUNDS) {
        newErrorMessage = 'Insufficient funds';
      } else if (
        operationSet.status === CreateOperationsStatus.NO_EXECUTION_PATH
      ) {
        newErrorMessage = 'No execution path';
      } else if (
        operationSet.status ===
        CreateOperationsStatus.INSUFFICIENT_FUNDS_FOR_GAS
      ) {
        newErrorMessage = 'Insufficient funds for gas. Choose another token';
      } else if (operationSet.status === CreateOperationsStatus.INTERNAL) {
        newErrorMessage = 'Internal error';
      } else if (
        operationSet.status === CreateOperationsStatus.INVALID_ARGUMENT
      ) {
        newErrorMessage = 'Invalid argument';
      }

      setErrorMessage(newErrorMessage);
    } else {
      setErrorMessage(null);
    }
  }, [operationSet?.status, isOrbyEnabled]);

  return errorMessage;
}
