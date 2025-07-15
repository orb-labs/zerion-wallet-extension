import type { OnchainOperation, UserOperation } from '@orb-labs/orby-core';
import { OperationDataFormat } from '@orb-labs/orby-core';
import type { TypedDataDomain, TypedDataField } from 'ethers';
import { walletPort } from 'src/ui/shared/channels';

async function signOperation(operation: OnchainOperation): Promise<string> {
  if (operation.format == OperationDataFormat.TRANSACTION) {
    const txData = {
      from: operation.from,
      to: operation.to,
      value: operation.value ? operation.value.toString() : undefined,
      data: operation.data,
      nonce: operation.nonce ? Number(operation.nonce) : undefined,
      gasLimit: operation?.gasLimit?.toString(),
      chainId: operation.chainId ? Number(operation.chainId) : undefined,
      gasPrice: operation?.gasPrice?.toString(),
      maxFeePerGas: operation?.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: operation?.maxPriorityFeePerGas?.toString(),
    };

    return (await walletPort.request('signTransaction', [txData])) as string;
  } else {
    const parsedData = JSON.parse(operation.data) as {
      domain: TypedDataDomain;
      types: Record<string, Array<TypedDataField>>;
      message: Record<string, any>;
    };

    delete parsedData.types['EIP712Domain'];
    return (await walletPort.request('signTypedData', {
      typedData: parsedData,
    })) as string;
  }
}

export async function signTransaction(
  operation: OnchainOperation
): Promise<string | undefined> {
  return await signOperation(operation);
}

export async function signUserOperation(
  _operations: OnchainOperation[],
  _accountAddress: string,
  _chainId: bigint,
  _txRpcUrl: string
): Promise<UserOperation | undefined> {
  // TODO: Implement user operation signing logic
  return undefined;
}

export async function signTypedData(
  operation: OnchainOperation
): Promise<string | undefined> {
  return await signOperation(operation);
}
