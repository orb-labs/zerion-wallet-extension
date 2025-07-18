import type { OnchainOperation, UserOperation } from '@orb-labs/orby-core';
import { OperationDataFormat, VMType } from '@orb-labs/orby-core';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import type { TypedDataDomain, TypedDataField } from 'ethers';
import { solToBase64 } from 'src/modules/solana/transactions/create';
import type { SolSignTransactionResult } from 'src/modules/solana/transactions/SolTransactionResponse';
import { walletPort } from 'src/ui/shared/channels';

const startsWith0xLen42HexRegex = /^0x[0-9a-fA-F]{40}$/;
const solanaRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function inferEncoding(data: string): BufferEncoding | undefined {
  // Hex: only 0-9, a-f, A-F
  const isHex = /^[0-9a-fA-F]+$/.test(data);

  // Base64: alphanumeric + + / = padding
  const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(data);

  if (isHex && !isBase64) return 'hex';
  if (isBase64 && !isHex) return 'base64';
  if (isHex && isBase64) return 'hex'; // Prefer hex for ambiguous cases
  return undefined;
}

export function toTransaction(
  data: string
): VersionedTransaction | Transaction {
  const buffer = Buffer.from(data, inferEncoding(data));
  try {
    return Transaction.from(buffer);
  } catch {
    return VersionedTransaction.deserialize(buffer);
  }
}

export const getWalletVirtualEnvironment = (
  address: string
): VMType | undefined => {
  if (startsWith0xLen42HexRegex.test(address)) {
    return VMType.EVM;
  } else if (solanaRegex.test(address)) {
    return VMType.SVM;
  }

  return undefined;
};

export async function signSVMTransaction(
  txRpcUrl: string,
  data: string
): Promise<string> {
  const connection = new Connection(txRpcUrl);
  const originalTransaction = toTransaction(data);

  const { blockhash } = await connection.getLatestBlockhash();
  if (originalTransaction instanceof Transaction) {
    originalTransaction.recentBlockhash = blockhash;
  } else {
    originalTransaction.message.recentBlockhash = blockhash;
  }

  const result = (await walletPort.request('signSVMTransaction', {
    transaction: solToBase64(originalTransaction),
  })) as SolSignTransactionResult;

  return result.tx;
}

async function signEVMTransaction(
  operation: OnchainOperation
): Promise<string> {
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

async function signOperation(operation: OnchainOperation): Promise<string> {
  if (getWalletVirtualEnvironment(operation.from as string) == VMType.SVM) {
    return signSVMTransaction(operation.txRpcUrl, operation.data);
  }

  return signEVMTransaction(operation);
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
