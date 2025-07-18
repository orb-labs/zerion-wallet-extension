import { ethers } from 'ethers';
import { Provider as ZksProvider } from 'zksync-ethers';
import type { Keypair } from '@solana/web3.js';
import { Connection } from '@solana/web3.js';
import type { Emitter } from 'nanoevents';
import { createNanoEvents } from 'nanoevents';
import { nanoid } from 'nanoid';
import omit from 'lodash/omit';
import { isTruthy } from 'is-truthy-ts';
import type {
  NotificationWindow,
  NotificationWindowProps,
} from 'src/background/NotificationWindow/NotificationWindow';
import type {
  ChannelContext,
  PrivateChannelContext,
} from 'src/shared/types/ChannelContext';
import { isEthereumAddress } from 'src/shared/isEthereumAddress';
import {
  InvalidParams,
  MethodNotImplemented,
  OriginNotAllowed,
  RecordNotFound,
  SessionExpired,
  SwitchChainError,
  UserRejected,
  UserRejectedTxSignature,
} from 'src/shared/errors/errors';
import {
  INTERNAL_ORIGIN,
  INTERNAL_ORIGIN_SYMBOL,
} from 'src/background/constants';
import {
  fetchNetworkByChainId,
  fetchNetworkById,
  getNetworksStore,
} from 'src/modules/networks/networks-store.background';
import type {
  IncomingTransaction,
  IncomingTransactionAA,
  IncomingTransactionWithChainId,
} from 'src/modules/ethereum/types/IncomingTransaction';
import { prepareTransaction } from 'src/modules/ethereum/transactions/prepareTransaction';
import type { Chain } from 'src/modules/networks/Chain';
import { createChain } from 'src/modules/networks/Chain';
import { prepareGasAndNetworkFee } from 'src/modules/ethereum/transactions/fetchAndAssignGasPrice';
import type { TypedData } from 'src/modules/ethereum/message-signing/TypedData';
import { prepareTypedData } from 'src/modules/ethereum/message-signing/prepareTypedData';
import { toUtf8String } from 'src/modules/ethereum/message-signing/toUtf8String';
import { removeSignature } from 'src/modules/ethereum/transactions/removeSignature';
import { normalizeAddress } from 'src/shared/normalizeAddress';
import type { PartiallyRequired } from 'src/shared/type-utils/PartiallyRequired';
import { isKnownDapp } from 'src/shared/dapps/known-dapps';
import type { WalletAbility } from 'src/shared/types/Daylight';
import type { AddEthereumChainParameter } from 'src/modules/ethereum/types/AddEthereumChainParameter';
import { chainConfigStore } from 'src/modules/ethereum/chains/ChainConfigStore';
import { NetworkId } from 'src/modules/networks/NetworkId';
import { invariant } from 'src/shared/invariant';
import { getEthersError } from 'src/shared/errors/getEthersError';
import type { DappSecurityStatus } from 'src/modules/phishing-defence/phishing-defence-service';
import { phishingDefenceService } from 'src/modules/phishing-defence/phishing-defence-service';
import {
  isDeviceAccount,
  isMnemonicContainer,
} from 'src/shared/types/validators';
import { ERC20_ALLOWANCE_ABI } from 'src/modules/ethereum/abi/allowance-abi';
import { Disposable } from 'src/shared/Disposable';
import { getWalletNameFlagsByOrigin } from 'src/shared/preferences-helpers';
import type {
  MessageContextParams,
  TransactionContextParams,
} from 'src/shared/types/SignatureContextParams';
import { normalizeChainId } from 'src/shared/normalizeChainId';
import { Networks } from 'src/modules/networks/Networks';
import { backgroundGetBestKnownTransactionCount } from 'src/modules/ethereum/transactions/getBestKnownTransactionCount/backgroundGetBestKnownTransactionCount';
import { toCustomNetworkId } from 'src/modules/ethereum/chains/helpers';
import { normalizeTransactionChainId } from 'src/modules/ethereum/transactions/normalizeTransactionChainId';
import type { ChainId } from 'src/modules/ethereum/transactions/ChainId';
import {
  createTypedData,
  serializePaymasterTx,
} from 'src/modules/ethereum/account-abstraction/createTypedData';
import { getDefiSdkClient } from 'src/modules/defi-sdk/background';
import type { NetworkConfig } from 'src/modules/networks/NetworkConfig';
import type { LocallyEncoded } from 'src/shared/wallet/encode-locally';
import { decodeMasked } from 'src/shared/wallet/encode-locally';
import type { RemoteConfig } from 'src/modules/remote-config';
import { getRemoteConfigValue } from 'src/modules/remote-config';
import { ZerionAPI } from 'src/modules/zerion-api/zerion-api.background';
import { referralProgramService } from 'src/ui/features/referral-program/ReferralProgramService.background';
import type { ButtonClickedParams } from 'src/shared/types/button-events';
import { signTypedData } from 'src/modules/ethereum/message-signing/signTypedData';
import type { SerializableTransactionResponse } from 'src/modules/ethereum/types/TransactionResponsePlain';
import {
  broadcastTransactionPatched,
  checkEip712Tx,
} from 'src/modules/ethereum/account-abstraction/zksync-patch';
import { isSolanaAddress } from 'src/modules/solana/shared';
import {
  solFromBase64,
  solToBase64,
} from 'src/modules/solana/transactions/create';
import { fromSecretKeyToEd25519 } from 'src/modules/solana/keypairs';
import type { SolSignTransactionResult } from 'src/modules/solana/transactions/SolTransactionResponse';
import type { BlockchainType } from 'src/shared/wallet/classifiers';
import { base64ToUint8Array, uint8ArrayToBase64 } from 'src/modules/crypto';
import { SolanaSigning } from 'src/modules/solana/signing';
import { isMatchForEcosystem } from 'src/shared/wallet/shared';
import type { AtLeastOneOf } from 'src/shared/type-utils/OneOf';
import type { StringBase64 } from 'src/shared/types/StringBase64';
import { createApprovalTransaction } from 'src/modules/ethereum/transactions/appovals';
import type { DaylightEventParams, ScreenViewParams } from '../events';
import { emitter } from '../events';
import type { Credentials, SessionCredentials } from '../account/Credentials';
import { isSessionCredentials } from '../account/Credentials';
import { lastUsedAddressStore } from '../user-activity';
import { transactionService } from '../transactions/TransactionService';
import { toEthersWallet } from './helpers/toEthersWallet';
import { maskWallet, maskWalletGroup, maskWalletGroups } from './helpers/mask';
import type { PendingWallet, WalletRecord } from './model/types';
import type { MaskedBareWallet } from './model/BareWallet';
import {
  MnemonicWalletContainer,
  PrivateKeyWalletContainer,
} from './model/WalletContainer';
import { WalletRecordModel as Model } from './WalletRecord';
import { WalletStore } from './persistence';
import { WalletOrigin } from './model/WalletOrigin';
import { globalPreferences } from './GlobalPreferences';
import type { State as GlobalPreferencesState } from './GlobalPreferences';
import type { Device, DeviceAccount } from './model/AccountContainer';
import {
  DeviceAccountContainer,
  ReadonlyAccountContainer,
} from './model/AccountContainer';
import { toPlainTransactionResponse } from './model/ethers-v5-types';

async function prepareNonce<
  T extends { nonce?: number | null; from?: string | null }
>(transaction: T, network: NetworkConfig) {
  if (transaction.nonce == null) {
    invariant(transaction.from, '"from" field is missing from transaction');
    const txCount = await backgroundGetBestKnownTransactionCount({
      network,
      address: transaction.from,
      defaultBlock: 'pending',
    });
    return { ...transaction, nonce: txCount.value };
  } else {
    return transaction;
  }
}

export const INTERNAL_SYMBOL_CONTEXT = { origin: INTERNAL_ORIGIN_SYMBOL };

type PublicMethodParams<T = undefined> = T extends undefined
  ? {
      id: string | number;
      context?: Partial<ChannelContext>;
    }
  : {
      id: string | number;
      params: T;
      context?: Partial<ChannelContext>;
    };

type WalletMethodParams<T = undefined> = T extends undefined
  ? {
      context?: Partial<ChannelContext | PrivateChannelContext>;
    }
  : {
      params: T;
      context?: Partial<ChannelContext | PrivateChannelContext>;
    };

interface WalletEvents {
  recordUpdated: () => void;
  currentAddressChange: (addresses: string[]) => void;
  chainChanged: (chain: Chain, origin: string) => void;
  switchChainError: (chainId: ChainId, origin: string) => void;
  permissionsUpdated: () => void;
}

export class Wallet {
  public id: string;
  // eslint-disable-next-line no-use-before-define
  public publicEthereumController: PublicController;
  private userCredentials: Credentials | null;
  private seedPhraseExpiryTimerId: NodeJS.Timeout | number = 0;
  private pendingWallet: PendingWallet | null = null;
  private record: WalletRecord | null;

  private disposer = new Disposable();

  walletStore: WalletStore;
  notificationWindow: NotificationWindow;

  emitter: Emitter<WalletEvents>;

  constructor(
    id: string,
    userCredentials: Credentials | null,
    notificationWindow: NotificationWindow
  ) {
    this.emitter = createNanoEvents();

    this.id = id;
    this.walletStore = new WalletStore({}, 'wallet');
    this.disposer.add(
      globalPreferences.on('change', (state, prevState) => {
        emitter.emit('globalPreferencesChange', state, prevState);
      })
    );
    this.disposer.add(
      this.walletStore.on('change', this.notifyExternalStores.bind(this))
    );
    this.disposer.add(
      emitter.on('transactionSent', (result, { chain, clientScope }) => {
        if (result.evm && clientScope === 'Swap') {
          this.setLastSwapChainByAddress({
            address: result.evm.from,
            chain,
          });
        }
      })
    );

    this.notificationWindow = notificationWindow;
    this.userCredentials = userCredentials;
    this.record = null;

    this.syncWithWalletStore();
    this.publicEthereumController = new PublicController(this, {
      notificationWindow,
    });
  }

  destroy() {
    this.disposer.clearAll();
  }

  /** Pulls data (decrypts) into {this.record} <-- from {walletStore} */
  private async syncWithWalletStore() {
    await this.walletStore.ready();
    if (!this.userCredentials) {
      return;
    }
    this.record = await this.walletStore.read(this.id, this.userCredentials);
    this.notifyExternalStores();
    if (this.record) {
      this.emitter.emit('recordUpdated');
    }
  }

  /** Pushes data (encrypts) from {this.record} --> into {walletStore} */
  private async updateWalletStore(record: WalletRecord) {
    if (!this.userCredentials) {
      throw new Error('Cannot save pending wallet: encryptionKey is null');
    }
    this.walletStore.save(this.id, this.userCredentials.encryptionKey, record);
  }

  async ready() {
    return this.walletStore.ready();
  }

  async getId() {
    return this.id;
  }

  async userHeartbeat({ context }: WalletMethodParams) {
    this.verifyInternalOrigin(context);
    emitter.emit('userActivity');
  }

  /** throws if encryptionKey is wrong */
  async verifyCredentials({
    params: { id, encryptionKey },
  }: PublicMethodParams<{ id: string; encryptionKey: string }>) {
    await this.walletStore.ready();
    await this.walletStore.check(id, encryptionKey);
  }

  hasSeedPhraseEncryptionKey() {
    return Boolean(this.userCredentials?.seedPhraseEncryptionKey);
  }

  removeSeedPhraseEncryptionKey() {
    if (this.userCredentials) {
      this.userCredentials.seedPhraseEncryptionKey = null;
      this.userCredentials.seedPhraseEncryptionKey_deprecated = null;
    }
  }

  private setExpirationForSeedPhraseEncryptionKey(timeout: number) {
    clearTimeout(this.seedPhraseExpiryTimerId);
    this.seedPhraseExpiryTimerId = setTimeout(() => {
      if (this) {
        this.removeSeedPhraseEncryptionKey();
      }
    }, timeout);
  }

  async updateCredentials({
    params: { credentials, isNewUser },
  }: PublicMethodParams<{ credentials: Credentials; isNewUser: boolean }>) {
    this.id = credentials.id;
    this.userCredentials = credentials;
    this.setExpirationForSeedPhraseEncryptionKey(
      isNewUser ? 1000 * 1800 : 1000 * 120
    );
    await this.syncWithWalletStore();
  }

  async resetCredentials() {
    this.userCredentials = null;
  }

  async testMethod({ params: value }: WalletMethodParams<number>) {
    return new Promise<string>((r) =>
      setTimeout(
        () => r(`Hello, curious developer. Your value is ${value}`),
        1500
      )
    );
  }

  // TODO: For now, I prefix methods with "ui" which return wallet data and are supposed to be called
  // from the UI (extension popup) thread. It's maybe better to refactor them
  // into a separate isolated class
  async uiGenerateMnemonic({
    params: { ecosystems },
  }: WalletMethodParams<{ ecosystems: BlockchainType[] }>) {
    this.ensureActiveSession(this.userCredentials);
    const walletContainer = await MnemonicWalletContainer.create({
      credentials: this.userCredentials,
      ecosystems: ecosystems,
    });
    this.pendingWallet = {
      origin: WalletOrigin.extension,
      groupId: null,
      walletContainer,
    };
    return walletContainer.wallets.map((wallet) => maskWallet(wallet));
  }

  async uiImportPrivateKey({
    params: privateKey,
  }: WalletMethodParams<LocallyEncoded>) {
    const walletContainer = new PrivateKeyWalletContainer([
      { privateKey: decodeMasked(privateKey) },
    ]);
    this.pendingWallet = {
      origin: WalletOrigin.imported,
      groupId: null,
      walletContainer,
    };
    return maskWallet(walletContainer.getFirstWallet());
  }

  async uiImportSeedPhrase({
    params: mnemonics,
  }: WalletMethodParams<NonNullable<MaskedBareWallet['mnemonic']>[]>) {
    this.ensureActiveSession(this.userCredentials);
    const walletContainer = await MnemonicWalletContainer.create({
      wallets: mnemonics.map((mnemonic) => ({
        mnemonic: { ...mnemonic, phrase: decodeMasked(mnemonic.phrase) },
      })),
      credentials: this.userCredentials,
    });
    const existingGroup = this.record
      ? Model.getMatchingExistingWalletGroup(this.record, walletContainer)
      : null;
    this.pendingWallet = {
      origin: existingGroup?.origin ?? WalletOrigin.imported,
      groupId: null,
      walletContainer,
    };
    return maskWallet(walletContainer.getFirstWallet());
  }

  async uiImportHardwareWallet({
    params: { accounts, device, provider },
  }: WalletMethodParams<{
    accounts: DeviceAccount[];
    device: Device;
    provider: 'ledger';
  }>) {
    invariant(accounts.length > 0, 'Must import at least 1 account');
    const walletContainer = new DeviceAccountContainer({
      device,
      wallets: accounts,
      provider,
    });
    this.pendingWallet = {
      origin: WalletOrigin.imported,
      groupId: null,
      walletContainer,
    };
    return walletContainer.getFirstWallet();
  }

  async uiImportReadonlyAddress({
    params: { address, name },
  }: WalletMethodParams<{ address: string; name: string | null }>) {
    const walletContainer = new ReadonlyAccountContainer([{ address, name }]);
    this.pendingWallet = {
      origin: WalletOrigin.imported,
      walletContainer,
      groupId: null,
    };
    return walletContainer.getFirstWallet();
  }

  async uiAddReadonlyAddress(
    params: WalletMethodParams<{ address: string; name: string | null }>
  ) {
    await this.uiImportReadonlyAddress(params);
    await this.savePendingWallet();
  }

  async uiApplyReferralCodeToAllWallets({
    params: { referralCode },
    context,
  }: WalletMethodParams<{ referralCode: string }>) {
    this.verifyInternalOrigin(context);
    return referralProgramService.applyReferralCodeToAllWallets({
      referralCode,
    });
  }

  async getPendingRecoveryPhrase({ context }: WalletMethodParams) {
    this.verifyInternalOrigin(context);
    this.ensureActiveSession(this.userCredentials);
    if (!this.pendingWallet) {
      return null;
    }
    return Model.getPendingRecoveryPhrase(
      this.pendingWallet,
      this.userCredentials
    );
  }

  async getPendingWallet({ context }: WalletMethodParams) {
    this.verifyInternalOrigin(context);
    const wallet = this.pendingWallet?.walletContainer.getFirstWallet();
    return wallet ? maskWallet(wallet) : null;
  }

  async getRecoveryPhrase({
    params: { groupId },
    context,
  }: WalletMethodParams<{ groupId: string }>) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    this.ensureActiveSession(this.userCredentials);
    return await Model.getRecoveryPhrase(this.record, {
      groupId,
      credentials: this.userCredentials,
    });
  }

  async verifyRecoveryPhrase({
    params: { groupId, value },
    context,
  }: WalletMethodParams<{ groupId: string; value: LocallyEncoded }>) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    this.ensureActiveSession(this.userCredentials);
    const mnemonic = await Model.getRecoveryPhrase(this.record, {
      groupId,
      credentials: this.userCredentials,
    });
    return mnemonic.phrase === value;
  }

  async getPrivateKey({
    params: { address },
    context,
  }: WalletMethodParams<{ address: string }>) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    this.ensureActiveSession(this.userCredentials); // require anyway
    return await Model.getPrivateKey(this.record, { address });
  }

  async verifyPrivateKey({
    params: { address, value },
    context,
  }: WalletMethodParams<{ address: string; value: LocallyEncoded }>) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    this.ensureActiveSession(this.userCredentials); // require anyway
    const privateKey = await Model.getPrivateKey(this.record, { address });
    return privateKey === value;
  }

  getCurrentWalletSync({ context }: WalletMethodParams) {
    this.verifyInternalOrigin(context);
    if (!this.id) {
      return null;
    }
    const currentAddress = this.readCurrentAddress();
    if (this.record && currentAddress) {
      const wallet =
        Model.getWalletByAddress(this.record, {
          address: currentAddress,
          groupId: null,
        }) || Model.getFirstWallet(this.record);
      return wallet ? maskWallet(wallet) : null;
    }
    return null;
  }

  async uiGetCurrentWallet({ context }: WalletMethodParams) {
    this.verifyInternalOrigin(context);
    return this.getCurrentWalletSync({ context });
  }

  async uiGetWalletByAddress({
    context,
    params: { address, groupId },
  }: WalletMethodParams<{ address: string; groupId: string | null }>) {
    this.verifyInternalOrigin(context);
    if (!this.record) {
      throw new RecordNotFound();
    }
    if (!address) {
      throw new Error('Illegal argument: address is required for this method');
    }
    const wallet = Model.getWalletByAddress(this.record, { address, groupId });
    return wallet ? maskWallet(wallet) : null;
  }

  async savePendingWallet() {
    if (!this.pendingWallet) {
      throw new Error('Cannot save pending wallet: pendingWallet is null');
    }
    if (!this.userCredentials) {
      throw new Error('Cannot save pending wallet: userCredentials are null');
    }
    this.record = Model.createOrUpdateRecord(this.record, this.pendingWallet);
    const pendingWallet = this.pendingWallet;
    this.pendingWallet = null;
    this.removeSeedPhraseEncryptionKey();
    this.updateWalletStore(this.record);
    emitter.emit('walletCreated', pendingWallet);
  }

  async acceptOrigin({
    params: { origin, address },
    context,
  }: WalletMethodParams<{ origin: string; address: string }>) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    this.record = Model.addPermission(this.record, { address, origin });
    this.updateWalletStore(this.record);
    this.emitter.emit('permissionsUpdated');
  }

  async removeAllOriginPermissions({ context }: PublicMethodParams) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    this.record = Model.removeAllOriginPermissions(this.record);
    this.updateWalletStore(this.record);
    this.emitter.emit('permissionsUpdated');
  }

  async removeSolanaPermissions({
    context,
    params: { origin },
  }: WalletMethodParams<{ origin: string; address?: string }>) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    this.record = Model.removeSolanaPermissions(this.record, { origin });
    this.updateWalletStore(this.record);
    this.emitter.emit('permissionsUpdated');
  }

  async removePermission({
    context,
    params: { origin, address },
  }: WalletMethodParams<{ origin: string; address?: string }>) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    this.record = Model.removePermission(this.record, { origin, address });
    this.updateWalletStore(this.record);
    this.emitter.emit('permissionsUpdated');
  }

  async emitConnectionEvent({
    context,
    params: { origin },
  }: WalletMethodParams<{ origin: string }>) {
    this.verifyInternalOrigin(context);
    emitter.emit('connectToSiteEvent', { origin });
  }

  allowedOrigin(
    context: Partial<ChannelContext> | undefined,
    address: string
  ): context is PartiallyRequired<ChannelContext, 'origin'> {
    if (!context || !context.origin) {
      throw new Error('This method requires context');
    }
    if (context.origin === INTERNAL_ORIGIN) {
      return true;
    }
    if (!this.record) {
      return false;
    }
    return Model.isAccountAvailable(this.record, {
      address,
      origin: context.origin,
    });
  }

  async isAccountAvailableToOrigin({
    params: { address, origin },
    context,
  }: WalletMethodParams<{ address: string; origin: string }>) {
    this.verifyInternalOrigin(context);
    return !this.record
      ? false
      : Model.isAccountAvailable(this.record, { address, origin });
  }

  async getOriginPermissions({ context }: PublicMethodParams) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    return this.record.permissions;
  }

  async setCurrentAddress({
    params: { address },
    context,
  }: WalletMethodParams<{ address: string }>) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    this.record = Model.setCurrentAddress(this.record, { address });
    this.updateWalletStore(this.record);

    const { currentAddress } = this.record.walletManager;
    this.emitter.emit(
      'currentAddressChange',
      [currentAddress].filter(isTruthy)
    );
  }

  readCurrentAddress() {
    return this.record?.walletManager.currentAddress || null;
  }

  ensureCurrentAddress(): string {
    const currentAddress = this.readCurrentAddress();
    if (!currentAddress) {
      throw new Error('Wallet is not initialized');
    }
    return currentAddress;
  }

  private ensureRecord(
    record: WalletRecord | null
  ): asserts record is WalletRecord {
    if (!record) {
      throw new RecordNotFound();
    }
  }

  private ensureActiveSession(
    credentials: Credentials | null
  ): asserts credentials is SessionCredentials {
    if (!credentials || !isSessionCredentials(credentials)) {
      throw new SessionExpired();
    }
  }

  private verifyInternalOrigin(
    context: Partial<ChannelContext | PrivateChannelContext> | undefined
  ): asserts context is PartiallyRequired<
    ChannelContext | PrivateChannelContext,
    'origin'
  > {
    if (
      context?.origin !== INTERNAL_ORIGIN &&
      context?.origin !== INTERNAL_ORIGIN_SYMBOL
    ) {
      throw new OriginNotAllowed();
    }
  }

  // TODO: when is this helper needed?
  private ensureStringOrigin(
    context: Partial<ChannelContext | PrivateChannelContext> | undefined
  ): asserts context is PartiallyRequired<ChannelContext, 'origin'> {
    this.verifyInternalOrigin(context);
    if (typeof context.origin !== 'string') {
      throw new Error('Origin must be a string');
    }
  }

  async getCurrentAddress({ context }: WalletMethodParams) {
    this.verifyInternalOrigin(context);
    return this.readCurrentAddress();
  }

  async uiGetWalletGroups({ context }: WalletMethodParams) {
    this.verifyInternalOrigin(context);
    const groups = this.record?.walletManager.groups;
    return groups ? maskWalletGroups(groups) : null;
  }

  async getLastSwapChainByAddress({
    params: { address },
    context,
  }: WalletMethodParams<{ address: string }>) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    return Model.getLastSwapChain(this.record, { address });
  }

  private setLastSwapChainByAddress({
    address,
    chain,
  }: {
    address: string;
    chain: string;
  }) {
    this.ensureRecord(this.record);
    this.record = Model.setLastSwapChain(this.record, { address, chain });
    this.updateWalletStore(this.record);
  }

  async uiGetWalletGroup({
    params: { groupId },
    context,
  }: WalletMethodParams<{ groupId: string }>) {
    this.verifyInternalOrigin(context);
    const group = this.record?.walletManager.groups.find(
      (group) => group.id === groupId
    );
    return group ? maskWalletGroup(group) : null;
  }

  getWalletGroupByAddressSync({
    params: { address },
    context,
  }: WalletMethodParams<{ address: string }>) {
    this.verifyInternalOrigin(context);
    if (!this.id) {
      return null;
    }
    if (this.record) {
      const group = Model.getWalletGroupByAddress(this.record, address);
      return group ? maskWalletGroup(group) : null;
    }
    return null;
  }

  async getWalletGroupByAddress({
    params,
    context,
  }: WalletMethodParams<{ address: string }>) {
    this.verifyInternalOrigin(context);
    return this.getWalletGroupByAddressSync({ params, context });
  }

  async removeWalletGroup({
    params: { groupId },
    context,
  }: WalletMethodParams<{ groupId: string }>) {
    this.verifyInternalOrigin(context);
    if (!this.record) {
      throw new RecordNotFound();
    }
    this.record = Model.removeWalletGroup(this.record, { groupId });
    this.updateWalletStore(this.record);
  }

  async renameWalletGroup({
    params: { groupId, name },
    context,
  }: WalletMethodParams<{ groupId: string; name: string }>) {
    this.verifyInternalOrigin(context);
    if (!this.record) {
      throw new RecordNotFound();
    }
    this.record = Model.renameWalletGroup(this.record, { groupId, name });
    this.updateWalletStore(this.record);
  }

  async renameAddress({
    params: { address, name },
    context,
  }: WalletMethodParams<{ address: string; name: string }>) {
    this.verifyInternalOrigin(context);
    if (!this.record) {
      throw new RecordNotFound();
    }
    this.record = Model.renameAddress(this.record, { address, name });
    this.updateWalletStore(this.record);
  }

  async removeAddress({
    params: { address, groupId },
    context,
  }: WalletMethodParams<{ address: string; groupId: string | null }>) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    this.record = Model.removeAddress(this.record, { address, groupId });
    this.updateWalletStore(this.record);
  }

  async updateLastBackedUp({
    params: { groupId },
    context,
  }: WalletMethodParams<{ groupId: string }>) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);

    if (!groupId) {
      throw new Error('Must provide groupId');
    }
    this.record = Model.updateLastBackedUp(this.record, {
      groupId,
      timestamp: Date.now(),
    });
    this.updateWalletStore(this.record);
  }

  async getNoBackupCount({ context }: WalletMethodParams) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    return this.record.walletManager.groups
      .filter((group) => isMnemonicContainer(group.walletContainer))
      .filter((group) => group.origin === WalletOrigin.extension)
      .filter((group) => group.lastBackedUp == null).length;
  }

  async setPreferences({
    context,
    params: { preferences },
  }: WalletMethodParams<{
    preferences: Partial<WalletRecord['publicPreferences']>;
  }>) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    this.record = Model.setPreferences(this.record, { preferences });
    this.updateWalletStore(this.record);
  }

  async getPreferences({
    context,
  }: WalletMethodParams): Promise<ReturnType<typeof Model.getPreferences>> {
    this.verifyInternalOrigin(context);
    return Model.getPreferences(this.record);
  }

  /** bound to instance */
  private async notifyChainConfigStore() {
    const preferences = await this.getPreferences({
      context: INTERNAL_SYMBOL_CONTEXT,
    });
    const on = Boolean(preferences.testnetMode?.on);
    const client = getDefiSdkClient({ on });
    chainConfigStore.setDefiSdkClient(client);
  }

  private notifyLastUsedAddressStore() {
    const currentAddress = this.readCurrentAddress();
    if (this.id && currentAddress) {
      lastUsedAddressStore.setState({
        address: currentAddress,
        walletModelId: this.id,
      });
    }
  }

  private async notifyExternalStores() {
    // TODO: should we inline the contents of these methods here?
    this.notifyChainConfigStore();
    this.notifyLastUsedAddressStore();
  }

  async getLastUsedAddress({
    context,
    params: { userId },
  }: WalletMethodParams<{ userId: string }>) {
    this.verifyInternalOrigin(context);
    const state = lastUsedAddressStore.getState();
    if (state && state?.walletModelId === userId) {
      return state.address;
    } else {
      return null;
    }
  }

  async getGlobalPreferences({ context }: WalletMethodParams) {
    this.verifyInternalOrigin(context);
    await globalPreferences.ready();
    return globalPreferences.getPreferences();
  }

  async setGlobalPreferences({
    context,
    params: { preferences },
  }: WalletMethodParams<{ preferences: Partial<GlobalPreferencesState> }>) {
    this.verifyInternalOrigin(context);
    await globalPreferences.ready();
    return globalPreferences.setPreferences(preferences);
  }

  async getRemoteConfigValue({
    context,
    params: { key },
  }: WalletMethodParams<{ key: keyof RemoteConfig }>) {
    this.verifyInternalOrigin(context);
    return getRemoteConfigValue(key);
  }

  async getFeedInfo({
    context,
  }: WalletMethodParams): Promise<ReturnType<typeof Model.getFeedInfo>> {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    return Model.getFeedInfo(this.record);
  }

  async markAbility({
    context,
    params: { ability, action },
  }: WalletMethodParams<{
    ability: WalletAbility;
    action: 'dismiss' | 'complete';
  }>) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    this.record = Model.markAbility(this.record, { ability, action });
    this.updateWalletStore(this.record);
    const currentAddress = normalizeAddress(this.ensureCurrentAddress());
    emitter.emit('daylightAction', {
      event_name:
        action === 'complete'
          ? 'Perks: Complete Tab Clicked'
          : 'Perks: Dismiss Tab Clicked',
      ability_id: ability.uid,
      perk_type: ability.type,
      address: currentAddress,
    });
  }

  async unmarkAbility({
    context,
    params: { abilityId },
  }: WalletMethodParams<{
    abilityId: string;
  }>) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    this.record = Model.unmarkAbility(this.record, { abilityId });
    this.updateWalletStore(this.record);
  }

  async createApprovalTransaction({
    context,
    params: { chain, contractAddress, allowanceQuantityBase, spender },
  }: WalletMethodParams<{
    chain: string;
    contractAddress: string;
    allowanceQuantityBase: string;
    spender: string;
  }>): Promise<{
    from?: string;
    chainId: string;
    data: string;
    to: string;
  }> {
    this.verifyInternalOrigin(context);
    const networksStore = getNetworksStore(Model.getPreferences(this.record));
    const networks = await networksStore.load({ chains: [chain] });
    const chainId = networks.getChainId(createChain(chain));
    invariant(chainId, 'Chain id should exist for approve transaction');
    const tx = await createApprovalTransaction({
      contractAddress,
      spenderAddress: spender,
      amountBase: allowanceQuantityBase,
    });
    return { ...tx, chainId };
  }

  async fetchAllowance({
    context,
    params: { chain, contractAddress, owner, spender },
  }: WalletMethodParams<{
    chain: string;
    contractAddress: string;
    spender: string;
    owner: string;
  }>) {
    this.verifyInternalOrigin(context);
    const networksStore = getNetworksStore(Model.getPreferences(this.record));
    const networks = await networksStore.load({ chains: [chain] });
    const chainId = networks.getChainId(createChain(chain));
    invariant(chainId, 'Chain id should exist for fetch allowance');
    const provider = await this.getProvider(chainId);
    const contract = new ethers.Contract(
      contractAddress,
      ERC20_ALLOWANCE_ABI,
      provider
    );
    const resultUntyped = await contract.allowance(owner, spender);
    const result = resultUntyped as bigint | string;
    return BigInt(result).toString();
  }

  async switchChainForOrigin({
    params: { evmChain, solanaChain, origin },
    context,
  }: WalletMethodParams<
    AtLeastOneOf<{ evmChain: string; solanaChain: string }> & { origin: string }
  >) {
    this.verifyInternalOrigin(context);
    this.setChainForOrigin({
      evmChain: evmChain ? createChain(evmChain) : undefined,
      solanaChain: solanaChain ? createChain(solanaChain) : undefined,
      origin,
    } as Parameters<Wallet['setChainForOrigin']>[0]);
  }

  async uiChainSelected({
    params: { chain },
    context,
  }: WalletMethodParams<{ chain: string }>) {
    this.verifyInternalOrigin(context);
    emitter.emit('ui:chainSelected', createChain(chain));
  }

  /** @deprecated */
  async requestChainId({ context: _context }: PublicMethodParams) {
    throw new Error('requestChainId is deprecated');
  }

  private async getNetworkForOrigin({
    origin,
    standard,
  }: {
    origin: string;
    standard: BlockchainType;
  }) {
    if (!this.record) {
      return null;
    }
    const chain = Model.getChainForOrigin(this.record, { origin, standard });
    if (!chain) {
      return null;
    }
    const preferences = Model.getPreferences(this.record);
    const network = await fetchNetworkById({
      networkId: chain,
      preferences,
      apiEnv: 'testnet-first',
    });
    return network;
  }

  async getChainIdForOrigin({ origin }: { origin: string }) {
    const network = await this.getNetworkForOrigin({ origin, standard: 'evm' });
    if (network) {
      return Networks.getChainId(network);
    } else {
      const currentAddress = this.readCurrentAddress();
      const fallbackChainId = '0x1' as ChainId;
      if (currentAddress && isSolanaAddress(currentAddress)) {
        // TODO: What's the correct return value in this case? Can we avoid this?
        // eslint-disable-next-line no-console
        console.warn(
          `Solana does not support chainId (requested by ${origin})`
        );
      }
      return fallbackChainId;
    }
  }

  async requestChainForOrigin({
    params: { origin, standard },
    context,
  }: WalletMethodParams<{ origin: string; standard: BlockchainType }>) {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    const network = await this.getNetworkForOrigin({ origin, standard });
    if (network) {
      return network.id;
    } else {
      return standard === 'solana' ? NetworkId.Solana : NetworkId.Ethereum;
    }
  }

  /** @deprecated */
  setChainId(_chainId: string) {
    throw new Error('setChainId is deprecated. Use setChainForOrigin instead');
  }

  setChainForOrigin(
    params: Parameters<(typeof Model)['setChainForOrigin']>[1]
  ) {
    this.ensureRecord(this.record);
    this.record = Model.setChainForOrigin(this.record, params);
    this.updateWalletStore(this.record);
    if (params.evmChain) {
      // TODO: Is it a good idea to split into explicit 'evm:chainChanged' and 'solana:chainChanged' events?
      this.emitter.emit('chainChanged', params.evmChain, params.origin);
    }
    if (params.solanaChain) {
      this.emitter.emit('chainChanged', params.solanaChain, params.origin);
    }
  }

  /** A helper for interpretation in UI */
  async uiGetEip712Transaction({
    params: { transaction },
    context,
  }: WalletMethodParams<{ transaction: IncomingTransactionWithChainId }>) {
    this.verifyInternalOrigin(context);

    const prepared = prepareTransaction(transaction);
    const typedData = createTypedData(prepared);
    return typedData;
  }

  private async getNodeUrlByChainId(chainId: ChainId) {
    const networksStore = getNetworksStore(Model.getPreferences(this.record));
    const networks = await networksStore.loadNetworksByChainId(chainId);
    return networks.getRpcUrlInternal(networks.getChainById(chainId));
  }

  private async getZkSyncProvider(chainId: ChainId) {
    const nodeUrl = await this.getNodeUrlByChainId(chainId);
    return new ZksProvider(nodeUrl); // return new ethers.providers.JsonRpcProvider(nodeUrl);
  }

  private async getProvider(chainId: ChainId) {
    const nodeUrl = await this.getNodeUrlByChainId(chainId);
    return new ethers.JsonRpcProvider(nodeUrl);
  }

  private getKeypairByAddress(address: string): Keypair {
    this.ensureRecord(this.record);
    invariant(isSolanaAddress(address), 'Keypairs are for solana addresseses');
    const signerWallet = Model.getSignerWalletByAddress(this.record, address);
    invariant(signerWallet, `Signer wallet not found for ${address}`);

    return fromSecretKeyToEd25519(signerWallet.privateKey);
  }

  private getOfflineSignerByAddress(address: string) {
    this.ensureRecord(this.record);
    const wallet = Model.getSignerWalletByAddress(this.record, address);
    if (!wallet) {
      throw new Error('Signer wallet for this address is not found');
    }

    return toEthersWallet(wallet);
  }

  private getOfflineSigner() {
    this.ensureRecord(this.record);
    const currentAddress = this.ensureCurrentAddress();
    const currentWallet = currentAddress
      ? Model.getSignerWalletByAddress(this.record, currentAddress)
      : null;
    if (!currentWallet) {
      throw new Error('Signer wallet for this address is not found');
    }

    return toEthersWallet(currentWallet);
  }

  private async getSigner(chainId: ChainId) {
    const jsonRpcProvider = await this.getProvider(chainId);
    const wallet = this.getOfflineSigner();
    return wallet.connect(jsonRpcProvider);
  }

  /** NOTE: mutates {transaction} param. TODO? */
  private async resolveChainIdForTx({
    initiator,
    transaction,
  }: {
    transaction: IncomingTransactionAA;
    initiator: string;
  }): Promise<ChainId> {
    const dappChainId = await this.getChainIdForOrigin({
      origin: new URL(initiator).origin,
    });
    const txChainId = normalizeTransactionChainId(transaction);
    if (initiator === INTERNAL_ORIGIN) {
      // Transaction is initiated from our own UI
      invariant(txChainId, 'Internal transaction must have a chainId');
      return txChainId;
    } else if (txChainId) {
      if (dappChainId !== txChainId) {
        throw new Error("Transaction chainId doesn't match dapp chainId");
      }
      return txChainId;
    } else {
      // eslint-disable-next-line no-console
      console.warn('chainId field is missing from transaction object');
      transaction.chainId = dappChainId;
    }
    const chainId = normalizeTransactionChainId(transaction);
    invariant(chainId, 'Could not resolve chainId for transaction');
    return chainId;
  }

  private async sendTransaction({
    transaction: incomingTransaction,
    txContext,
    context,
  }: {
    transaction: IncomingTransactionAA;
    txContext: TransactionContextParams;
    context: Partial<ChannelContext> | undefined;
  }): Promise<SerializableTransactionResponse> {
    this.verifyInternalOrigin(context);
    if (!incomingTransaction.from) {
      throw new Error(
        '"from" field is missing from the transaction object. Send from current address?'
      );
    }
    const currentAddress = this.ensureCurrentAddress();
    const { initiator } = txContext;
    if (
      normalizeAddress(incomingTransaction.from) !==
      normalizeAddress(currentAddress)
    ) {
      throw new Error(
        // TODO?...
        'transaction "from" field is different from currently selected address'
      );
    }

    const chainId = await this.resolveChainIdForTx({
      transaction: incomingTransaction,
      initiator,
    });

    const { mode } = await this.assertNetworkMode({ chainId });

    const networksStore = getNetworksStore(Model.getPreferences(this.record));
    const networks = await networksStore.loadNetworksByChainId(chainId);
    const network = networks.getNetworkById(chainId);
    const prepared = prepareTransaction(incomingTransaction);
    const txWithFee = await prepareGasAndNetworkFee(prepared, networks, {
      source: mode === 'testnet' ? 'testnet' : 'mainnet',
      apiClient: ZerionAPI,
    });
    const transaction = await prepareNonce(txWithFee, network);

    const paymasterEligible = Boolean(transaction.customData?.paymasterParams);

    if (paymasterEligible) {
      try {
        const eip712Tx = omit(transaction, ['authorizationList']); // authorizationList can't be part of EIP712 transaction
        const { chainId } = eip712Tx;
        invariant(chainId, 'ChainId missing from TransactionRequest');
        const typedData = createTypedData(eip712Tx);
        const signature = await this.signTypedData_v4({
          context,
          params: { typedData, typedDataContext: txContext },
        });
        const rawTransaction = serializePaymasterTx({
          transaction: eip712Tx,
          signature,
        });

        return await this.sendSignedTransaction({
          context,
          params: { serialized: rawTransaction, txContext },
        });
      } catch (error) {
        throw getEthersError(error);
      }
    } else {
      try {
        const signer = await this.getSigner(chainId);
        const transactionResponse = await signer.sendTransaction({
          ...transaction,
          type: transaction.type ?? undefined, // to exclude null
        });
        const safeTx = removeSignature(transactionResponse);

        const safeTxPlain = toPlainTransactionResponse(safeTx);
        emitter.emit(
          'transactionSent',
          { evm: safeTxPlain },
          { mode, ...txContext }
        );
        return safeTxPlain;
      } catch (error) {
        throw getEthersError(error);
      }
    }
  }

  async signAndSendTransaction({
    params,
    context,
  }: WalletMethodParams<[IncomingTransactionAA, TransactionContextParams]>) {
    this.verifyInternalOrigin(context);
    this.ensureStringOrigin(context);
    const [transaction, transactionContextParams] = params;
    if (!transaction) {
      throw new InvalidParams();
    }
    return this.sendTransaction({
      transaction,
      context,
      txContext: transactionContextParams,
    });
  }

  async solana_signTransaction({
    params,
    context,
  }: WalletMethodParams<{
    transaction: StringBase64;
    params: TransactionContextParams;
    /** Whether to emit 'transactionSent' event */
    silent?: boolean;
  }>): Promise<SolSignTransactionResult> {
    this.verifyInternalOrigin(context);
    this.ensureStringOrigin(context);
    this.ensureRecord(this.record);
    const currentAddress = this.ensureCurrentAddress();
    // TODO: infer signer address from transaction instead
    invariant(isSolanaAddress(currentAddress), 'Active address is not solana');
    const {
      transaction: txBase64,
      params: transactionContextParams,
      silent = false,
    } = params;
    invariant(txBase64, () => new InvalidParams());
    const transaction = solFromBase64(txBase64);

    const keypair = this.getKeypairByAddress(currentAddress);
    const result = SolanaSigning.signTransaction(transaction, keypair);
    const { mode } = await this.assertNetworkMode({
      id: createChain('solana'),
    }); // MUST assert even if result is not used
    if (!silent) {
      emitter.emit(
        'transactionSent',
        { solana: result },
        { mode, ...transactionContextParams }
      );
    }
    return result;
  }

  async solana_signAllTransactions({
    params,
    context,
  }: WalletMethodParams<{
    transactions: StringBase64[];
    params: TransactionContextParams;
  }>): Promise<SolSignTransactionResult[]> {
    this.verifyInternalOrigin(context);
    this.ensureStringOrigin(context);
    this.ensureRecord(this.record);
    const currentAddress = this.ensureCurrentAddress();
    const { transactions: txsBase64, params: transactionContextParams } =
      params;
    invariant(txsBase64 && Array.isArray(txsBase64), () => new InvalidParams());
    invariant(txsBase64.length > 0, 'No transactions provided');
    const { mode } = await this.assertNetworkMode({
      id: createChain('solana'),
    }); // MUST assert even if result is not used
    const transactions = txsBase64.map((tx) => solFromBase64(tx));
    // TODO: infer signer address from transaction instead
    const keypair = this.getKeypairByAddress(currentAddress);
    const results = SolanaSigning.signAllTransactions(transactions, keypair);

    results.forEach((result, index) => {
      const contextParamsCopy = { ...transactionContextParams };
      if (index > 0) {
        /** TODO: Temporarily assume that addressAction describes only first tx */
        contextParamsCopy.addressAction = null;
      }
      emitter.emit(
        'transactionSent',
        { solana: result },
        { mode, ...contextParamsCopy }
      );
    });

    return results;
  }

  async solana_signAndSendTransaction({
    params,
    context,
  }: WalletMethodParams<{
    transaction: StringBase64;
    params: TransactionContextParams;
  }>): Promise<SolSignTransactionResult> {
    this.verifyInternalOrigin(context);
    this.ensureStringOrigin(context);
    this.ensureRecord(this.record);

    const { tx: signed, publicKey } = await this.solana_signTransaction({
      params: { ...params, silent: true },
      context,
    });
    const { mode } = await this.assertNetworkMode({
      id: createChain('solana'),
    }); // MUST assert even if result is not used
    const networksStore = getNetworksStore(Model.getPreferences(this.record));
    const network = await networksStore.fetchNetworkById('solana');
    const rpcUrl = Networks.getNetworkRpcUrlInternal(network);
    const connection = new Connection(rpcUrl, 'confirmed');

    const transaction = solFromBase64(signed);

    const signature = await connection.sendRawTransaction(
      transaction.serialize()
    );
    const result = { signature, publicKey, tx: solToBase64(transaction) };
    emitter.emit(
      'transactionSent',
      { solana: result },
      { mode, ...params.params }
    );
    return result;
  }

  async solana_signMessage({
    params: { messageHex, ...messageContextParams },
    context,
  }: WalletMethodParams<
    { messageHex: string } & MessageContextParams
  >): Promise<{ signatureSerialized: string }> {
    this.verifyInternalOrigin(context);
    this.ensureRecord(this.record);
    const messageUint8 = ethers.getBytes(messageHex);
    const address = this.ensureCurrentAddress();
    const keypair = this.getKeypairByAddress(address);
    const result = SolanaSigning.signMessage(messageUint8, keypair);
    this.registerPersonalSign({
      params: {
        address,
        message: messageUint8,
        ...messageContextParams,
      },
    });
    return {
      signatureSerialized: uint8ArrayToBase64(result.signature),
    };
  }

  async sendSignedTransaction({
    params,
    context,
  }: WalletMethodParams<{
    serialized: string;
    txContext: TransactionContextParams;
  }>): Promise<SerializableTransactionResponse> {
    this.verifyInternalOrigin(context);
    this.ensureStringOrigin(context);
    const { serialized, txContext } = params;
    const { chain } = txContext;
    const networksStore = getNetworksStore(Model.getPreferences(this.record));
    const networks = await networksStore.load({ chains: [chain] });
    const chainId = networks.getChainId(createChain(chain));
    invariant(chainId, 'Chain id should exist for send signed transaction');
    const { mode } = await this.assertNetworkMode({ chainId }); // MUST assert even if result is not used
    try {
      const isEip712Tx = checkEip712Tx(serialized);
      let transactionResponse: ethers.TransactionResponse;
      if (isEip712Tx) {
        const provider = await this.getZkSyncProvider(chainId);
        transactionResponse = await broadcastTransactionPatched(
          provider,
          serialized
        );
      } else {
        const provider = await this.getProvider(chainId);
        transactionResponse = await provider.broadcastTransaction(serialized);
      }
      const safeTx = removeSignature(transactionResponse);
      const safeTxPlain = toPlainTransactionResponse(safeTx);
      emitter.emit(
        'transactionSent',
        { evm: safeTxPlain },
        { mode, ...txContext }
      );
      return safeTxPlain;
    } catch (error) {
      throw getEthersError(error);
    }
  }

  async registerTypedDataSign({
    params: { address, typedData: rawTypedData, ...messageContextParams },
  }: WalletMethodParams<
    {
      address: string;
      typedData: TypedData | string;
    } & MessageContextParams
  >) {
    const typedData = prepareTypedData(rawTypedData);
    emitter.emit('typedDataSigned', {
      typedData,
      address,
      ...messageContextParams,
    });
  }

  async signTypedData_v4({
    params: { typedData: rawTypedData, typedDataContext: messageContextParams },
    context,
  }: WalletMethodParams<{
    typedData: TypedData | string;
    typedDataContext: MessageContextParams;
  }>) {
    this.verifyInternalOrigin(context);
    if (!rawTypedData) {
      throw new InvalidParams();
    }
    const signer = this.getOfflineSigner();
    const signature = signTypedData(rawTypedData, signer);

    this.registerTypedDataSign({
      params: {
        address: signer.address,
        typedData: rawTypedData,
        ...messageContextParams,
      },
    });
    return signature;
  }

  async registerPersonalSign({
    params: { message, ...messageContextParams },
  }: WalletMethodParams<
    {
      address: string;
      message: string | ethers.BytesLike;
    } & MessageContextParams
  >) {
    const messageAsUtf8String = toUtf8String(message);
    emitter.emit('messageSigned', {
      message: messageAsUtf8String,
      ...messageContextParams,
    });
  }

  async signMessage({
    params: { signerAddress, message, messageContextParams },
    context,
  }: WalletMethodParams<{
    signerAddress: string;
    message: string;
    messageContextParams: MessageContextParams;
  }>) {
    this.verifyInternalOrigin(context);
    const messageAsUtf8String = toUtf8String(message);

    // Some dapps provide a hex message that doesn't parse as a utf string,
    // but wallets sign it anyway
    const messageToSign = ethers.isHexString(messageAsUtf8String)
      ? ethers.getBytes(messageAsUtf8String)
      : messageAsUtf8String;

    const signer = this.getOfflineSignerByAddress(signerAddress);
    const signature = await signer.signMessage(messageToSign);
    this.registerPersonalSign({
      params: { address: signer.address, message, ...messageContextParams },
    });
    return signature;
  }

  async personalSign({
    params: {
      params: [message],
      ...messageContextParams
    },
    context,
  }: WalletMethodParams<
    {
      params: [string, string?, string?];
    } & MessageContextParams
  >) {
    this.verifyInternalOrigin(context);
    if (message == null) {
      throw new InvalidParams();
    }
    const currentAddress = this.ensureCurrentAddress();
    return this.signMessage({
      params: {
        signerAddress: currentAddress,
        message,
        messageContextParams,
      },
      context,
    });
  }

  async removeEthereumChain({
    context,
    params: { chain: chainStr },
  }: WalletMethodParams<{ chain: string }>) {
    this.ensureRecord(this.record);
    const affectedPermissions = Model.getPermissionsByChain(this.record, {
      chain: createChain(chainStr),
    });
    affectedPermissions.forEach(({ origin }) => {
      // TODO: remove chain for origin in case new chain is not set
      this.setChainForOrigin({
        evmChain: createChain(NetworkId.Ethereum),
        origin,
      });
    });
    this.resetEthereumChain({ context, params: { chain: chainStr } });
  }

  async addEthereumChain({
    context,
    params: { values, origin, chain: chainStr, prevChain: prevChainStr },
  }: WalletMethodParams<{
    values: [AddEthereumChainParameter];
    origin: string;
    chain: string | null;
    prevChain: string | null;
  }>) {
    this.verifyInternalOrigin(context);
    const chain = chainStr || toCustomNetworkId(values[0].chainId);
    // NOTE: This is where we might want to call something like
    // {await networksStore.loadNetworkConfigByChainId(values[0].chainId)}
    // IF we wanted to refactor networkStore to not hold searched values
    const result = chainConfigStore.addEthereumChain(values[0], {
      id: chain,
      prevId: prevChainStr,
      origin,
    });

    this.emitter.emit('chainChanged', createChain(chain), origin);
    emitter.emit('addEthereumChain', {
      values: [result.value],
      origin: result.origin,
    });
    return result;
  }

  async resetEthereumChain({
    context,
    params: { chain: chainStr },
  }: WalletMethodParams<{ chain: string }>) {
    this.verifyInternalOrigin(context);
    chainConfigStore.removeEthereumChain(createChain(chainStr));
  }

  addVisitedEthereumChainInternal(chain: Chain) {
    chainConfigStore.addVisitedChain(chain);
  }

  async addVisitedEthereumChain({
    context,
    params: { chain: chainStr },
  }: WalletMethodParams<{ chain: string }>) {
    this.verifyInternalOrigin(context);
    this.addVisitedEthereumChainInternal(createChain(chainStr));
  }

  async removeVisitedEthereumChain({
    context,
    params: { chain: chainStr },
  }: WalletMethodParams<{ chain: string }>) {
    this.verifyInternalOrigin(context);
    chainConfigStore.removeVisitedChain(createChain(chainStr));
  }

  async getOtherNetworkData({ context }: PublicMethodParams) {
    this.verifyInternalOrigin(context);
    await chainConfigStore.ready();
    const { ethereumChainConfigs, visitedChains = null } =
      chainConfigStore.getState();
    return { ethereumChainConfigs, visitedChains };
  }

  async getPendingTransactions({ context }: PublicMethodParams) {
    this.verifyInternalOrigin(context);
    return this.record?.transactions || [];
  }

  async buttonClicked({
    context,
    params,
  }: WalletMethodParams<ButtonClickedParams>) {
    this.verifyInternalOrigin(context);
    emitter.emit('buttonClicked', params);
  }

  async cloudflareChallengeIssued({ context }: WalletMethodParams) {
    this.verifyInternalOrigin(context);
    emitter.emit('cloudflareChallengeIssued');
  }

  async screenView({ context, params }: WalletMethodParams<ScreenViewParams>) {
    // NOTE: maybe consider adding a more generic method, e.g.:
    // walletPort.request('sendEvent', { event_name, params }).
    this.verifyInternalOrigin(context);
    emitter.emit('screenView', params);
  }

  async daylightAction({
    context,
    params,
  }: WalletMethodParams<DaylightEventParams>) {
    this.verifyInternalOrigin(context);
    emitter.emit('daylightAction', params);
  }

  async blockOriginWithWarning({
    params: { origin },
  }: WalletMethodParams<{ origin: string }>) {
    return phishingDefenceService.blockOriginWithWarning(origin);
  }

  async getDappSecurityStatus({
    params: { url },
  }: WalletMethodParams<{ url?: string | null }>): Promise<{
    status: DappSecurityStatus;
    isWhitelisted: boolean;
  }> {
    return phishingDefenceService.getDappSecurityStatus(url);
  }

  async ignoreDappSecurityWarning({
    params: { url },
  }: WalletMethodParams<{ url: string }>) {
    return phishingDefenceService.ignoreDappSecurityWarning(url);
  }

  async openSendTransaction({
    params: { params, context, id },
    context: walletContext,
  }: WalletMethodParams<
    Parameters<(typeof this.publicEthereumController)['eth_sendTransaction']>[0]
  >) {
    this.verifyInternalOrigin(walletContext);
    return this.publicEthereumController.eth_sendTransaction({
      params,
      context,
      id,
    });
  }

  async openPersonalSign({
    params: { params, context, id },
    context: walletContext,
  }: WalletMethodParams<
    Parameters<(typeof this.publicEthereumController)['personal_sign']>[0]
  >) {
    this.verifyInternalOrigin(walletContext);
    return this.publicEthereumController.personal_sign({
      params,
      context,
      id,
    }) as Promise<string>;
  }

  private async checkTestnetMode(
    options:
      | { chainId: ChainId; id?: undefined }
      | { id: Chain; chainId?: undefined }
  ): Promise<
    | { violation: true; network: NetworkConfig; mode: 'testnet' | 'default' }
    | { violation: false; network: null; mode: 'testnet' | 'default' }
  > {
    const preferences = await this.getPreferences({
      context: INTERNAL_SYMBOL_CONTEXT,
    });
    let network: NetworkConfig | null;
    if (options.chainId) {
      network = await fetchNetworkByChainId({
        preferences,
        chainId: options.chainId,
        apiEnv: 'testnet-first',
      });
    } else if (options.id) {
      network = await fetchNetworkById({
        preferences,
        networkId: options.id,
        apiEnv: 'testnet-first',
      });
    } else {
      throw new Error('Invalid options object');
    }
    const mode = preferences.testnetMode?.on ? 'testnet' : 'default';
    if (!network) {
      return { violation: false, network: null, mode };
    }
    if (Boolean(network.is_testnet) === Boolean(preferences.testnetMode?.on)) {
      return { violation: false, network: null, mode };
    } else {
      return { violation: true, network, mode };
    }
  }

  /** Signing mainnet transactions must not be allowed in testnet mode */
  private async assertNetworkMode(
    options: Parameters<typeof this.checkTestnetMode>[0]
  ) {
    const result = await this.checkTestnetMode(options);
    const { violation } = result;
    if (violation) {
      throw new Error(
        `Testnet Mode violation: ${result.network.name} is a mainnet. Turn off Testnet Mode before continuing`
      );
    }
    return result;
  }

  async ensureTestnetModeForChainId(chainId: ChainId, tabId: number | null) {
    const { violation, network, mode } = await this.checkTestnetMode({
      chainId,
    });
    if (violation && mode === 'testnet') {
      // Warn user that we're switching to mainnet from testmode
      return new Promise<void>((resolve, reject) => {
        this.notificationWindow.open({
          route: '/testnetModeGuard',
          search: `?targetNetwork=${JSON.stringify(network)}`,
          requestId: `${INTERNAL_ORIGIN}:${nanoid()}`,
          tabId,
          onResolve: async () => {
            await this.setPreferences({
              context: INTERNAL_SYMBOL_CONTEXT,
              params: { preferences: { testnetMode: { on: false } } },
            });
            resolve();
          },
          onDismiss: () => {
            reject(new UserRejected('User Rejected the Request'));
          },
        });
      });
    } else if (violation && mode === 'default') {
      // Enable testmode automatically without user confirmation
      await this.setPreferences({
        context: INTERNAL_SYMBOL_CONTEXT,
        params: { preferences: { testnetMode: { on: true } } },
      });
    }
  }

  async ensureTestnetModeForTx({
    transaction,
    initiator,
    tabId,
  }: {
    transaction: IncomingTransaction;
    initiator: string;
    tabId: number | null;
  }) {
    const chainId = await this.resolveChainIdForTx({
      transaction,
      initiator,
    });
    await this.ensureTestnetModeForChainId(chainId, tabId);
  }

  async getRpcUrlSolana() {
    const networksStore = getNetworksStore(Model.getPreferences(this.record));
    const network = await networksStore.fetchNetworkById('solana');
    const rpcUrl = Networks.getNetworkRpcUrlInternal(network);
    return rpcUrl;
  }

  async getRpcUrlByChainId({
    chainId,
    type,
  }: {
    chainId: ChainId;
    type: 'public' | 'internal';
  }) {
    const network = await fetchNetworkByChainId({
      preferences: Model.getPreferences(this.record),
      chainId,
      apiEnv: 'testnet-first',
    });
    if (network) {
      if (type === 'internal') {
        return Networks.getNetworkRpcUrlInternal(network);
      } else if (type === 'public') {
        return Networks.getRpcUrlPublic(network);
      } else {
        throw new Error(`Invalid Argument: ${type}`);
      }
    }
    return null;
  }

  async clearPendingTransactions({ context }: WalletMethodParams) {
    this.verifyInternalOrigin(context);
    transactionService.clearPendingTransactions();
  }
}

interface Web3WalletPermission {
  /**
   * This seems to be a method that didn't get much adoption, but
   * metamask and some dapps use it for some reason:
   * https://eips.ethereum.org/EIPS/eip-2255
   */
  // The name of the method corresponding to the permission
  parentCapability: string;

  // The date the permission was granted, in UNIX epoch time
  date?: number;
}

const debugValue = null;

class PublicController {
  wallet: Wallet;
  notificationWindow: NotificationWindow;

  constructor(
    wallet: Wallet,
    { notificationWindow }: { notificationWindow: NotificationWindow }
  ) {
    this.wallet = wallet;
    this.notificationWindow = notificationWindow;
  }

  private async safeOpenDialogWindow<T>(
    origin: string,
    props: NotificationWindowProps<T>
  ) {
    const id = await this.notificationWindow.open(props);
    phishingDefenceService
      .checkDapp(origin)
      .then(({ status, isWhitelisted }) => {
        if (status === 'phishing' && !isWhitelisted) {
          phishingDefenceService.blockOriginWithWarning(origin);
          this.notificationWindow.emit('reject', {
            id,
            error: new UserRejected('Malicious DApp'),
          });
        }
      });
  }

  async eth_accounts({ context }: PublicMethodParams) {
    const currentAddress = this.wallet.readCurrentAddress();
    if (!currentAddress) {
      return [];
    }
    if (this.wallet.allowedOrigin(context, currentAddress)) {
      return [currentAddress];
    } else {
      return [];
    }
  }

  async sol_connect({ context, id }: PublicMethodParams) {
    invariant(context?.origin, 'This method requires origin');
    return this.eth_requestAccounts(
      { id, context, params: [] },
      { ecosystem: 'solana' }
    );
  }

  async sol_disconnect({ context }: PublicMethodParams) {
    invariant(context?.origin, 'This method requires origin');

    return this.wallet.removeSolanaPermissions({
      context: INTERNAL_SYMBOL_CONTEXT,
      params: { origin: context.origin },
    });
  }

  async sol_signTransaction({
    id,
    params: { txBase64, clientScope },
    context,
  }: PublicMethodParams<{
    txBase64: string;
    clientScope?: string;
  }>) {
    return this.sol_signAndSendTransaction({
      id,
      params: { txBase64, clientScope, method: 'signTransaction' },
      context,
    });
  }

  async sol_signAndSendTransaction({
    id,
    params: { txBase64, clientScope, method = 'signAndSendTransaction' },
    context,
  }: PublicMethodParams<{
    txBase64: string;
    clientScope?: string;
    method?: 'signAndSendTransaction' | 'signTransaction';
  }>): Promise<SolSignTransactionResult> {
    const currentAddress = this.wallet.ensureCurrentAddress();
    if (!this.wallet.allowedOrigin(context, currentAddress)) {
      throw new OriginNotAllowed();
    }
    const searchParams = new URLSearchParams({
      origin: context.origin,
      transaction: txBase64,
      ecosystem: 'solana',
      method,
    });
    if (clientScope) {
      searchParams.append('clientScope', clientScope);
    }

    return new Promise((resolve, reject) => {
      this.safeOpenDialogWindow(context.origin, {
        requestId: `${context.origin}:${id}`,
        route: '/sendTransaction',
        // height: isDeviceWallet ? 800 : undefined,
        search: `?${searchParams}`,
        tabId: context.tabId || null,
        onResolve: (result: SolSignTransactionResult) => {
          resolve(result);
        },
        onDismiss: () => {
          reject(new UserRejectedTxSignature());
        },
      });
    });
  }

  async sol_signAllTransactions({
    id,
    params: { transactionsBase64, clientScope },
    context,
  }: PublicMethodParams<{
    transactionsBase64: string[];
    clientScope?: string;
  }>): Promise<SolSignTransactionResult[]> {
    const currentAddress = this.wallet.ensureCurrentAddress();
    if (!this.wallet.allowedOrigin(context, currentAddress)) {
      throw new OriginNotAllowed();
    }
    const searchParams = new URLSearchParams({
      origin: context.origin,
      transactions: JSON.stringify(transactionsBase64),
      ecosystem: 'solana',
      method: 'signAllTransactions',
    });
    if (clientScope) {
      searchParams.append('clientScope', clientScope);
    }

    return new Promise((resolve, reject) => {
      this.safeOpenDialogWindow(context.origin, {
        requestId: `${context.origin}:${id}`,
        route: '/sendTransaction',
        // height: isDeviceWallet ? 800 : undefined,
        search: `?${searchParams}`,
        tabId: context.tabId || null,
        onResolve: (result: SolSignTransactionResult[]) => {
          resolve(result);
        },
        onDismiss: () => {
          reject(new UserRejectedTxSignature());
        },
      });
    });
  }

  async sol_signMessage({
    id,
    params: { messageSerialized, clientScope },
    context,
  }: PublicMethodParams<{
    messageSerialized: string;
    clientScope?: string;
  }>) {
    const currentAddress = this.wallet.ensureCurrentAddress();
    invariant(isSolanaAddress(currentAddress));
    if (!this.wallet.allowedOrigin(context, currentAddress)) {
      throw new OriginNotAllowed();
    }

    const messageUint8 = base64ToUint8Array(messageSerialized);
    const searchParams = new URLSearchParams({
      method: 'signMessage',
      origin: context.origin,
      message: ethers.hexlify(messageUint8),
    });
    if (clientScope) {
      searchParams.append('clientScope', clientScope);
    }
    return new Promise((resolve, reject) => {
      this.safeOpenDialogWindow(context.origin, {
        requestId: `${context.origin}:${id}`,
        route: '/signMessage',
        // height: isDeviceWallet ? 800 : undefined,
        search: `?${searchParams}`,
        tabId: context.tabId || null,
        onResolve: (signature: string) => {
          resolve(signature);
        },
        onDismiss: () => {
          reject(new UserRejectedTxSignature());
        },
      });
    });
  }

  async eth_requestAccounts(
    {
      context,
      id,
      params,
    }: PublicMethodParams<[] | [{ nonEip6963Request?: boolean }] | null>,
    opts: { ecosystem: BlockchainType } = { ecosystem: 'evm' }
  ): Promise<string[]> {
    if (debugValue && process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('PublicController: eth_requestAccounts', debugValue);
    }
    const currentAddress = this.wallet.readCurrentAddress();
    if (
      currentAddress &&
      isMatchForEcosystem(currentAddress, opts.ecosystem) &&
      this.wallet.allowedOrigin(context, currentAddress)
    ) {
      const { origin } = context;
      emitter.emit('requestAccountsResolved', {
        origin,
        address: currentAddress,
        explicitly: false,
      });
      // Some ethereum dapps expect lowercase to be returned, otherwise they crash the moment after connection
      const result = [
        isEthereumAddress(currentAddress)
          ? currentAddress.toLowerCase()
          : currentAddress,
      ];
      if (debugValue && process.env.NODE_ENV === 'development') {
        result.push(String(debugValue));
      }
      return result;
    }
    if (!context?.origin) {
      throw new Error('This method requires origin');
    }
    const { origin } = context;
    return new Promise((resolve, reject) => {
      this.safeOpenDialogWindow(origin, {
        route: '/requestAccounts',
        search: `?origin=${origin}&nonEip6963Request=${String(
          params?.[0]?.nonEip6963Request ? 'yes' : 'no'
        )}&ecosystem=${opts.ecosystem}`,
        requestId: `${origin}:${id}`,
        tabId: context.tabId || null,
        onResolve: async ({
          address,
          origin: resolvedOrigin,
        }: {
          address: string;
          origin: string;
        }) => {
          invariant(address, 'Invalid arguments: missing address');
          invariant(resolvedOrigin, 'Invalid arguments: missing origin');
          invariant(resolvedOrigin === origin, 'Resolved origin mismatch');
          invariant(
            isMatchForEcosystem(address, opts.ecosystem),
            'Wrong addr for ecosystem'
          );
          const currentAddress = this.wallet.ensureCurrentAddress();
          if (normalizeAddress(address) !== normalizeAddress(currentAddress)) {
            await this.wallet.setCurrentAddress({
              params: { address },
              context: INTERNAL_SYMBOL_CONTEXT,
            });
          }
          this.wallet.acceptOrigin({
            params: { origin, address },
            context: INTERNAL_SYMBOL_CONTEXT,
          });
          const accounts = await this.eth_accounts({ context, id });
          emitter.emit('requestAccountsResolved', {
            origin,
            address,
            explicitly: true,
          });
          resolve(accounts.map((item) => normalizeAddress(item)));
        },
        onDismiss: () => {
          reject(new UserRejected('User Rejected the Request'));
        },
      });
    });
  }

  async eth_chainId({ context }: PublicMethodParams): Promise<string> {
    /**
     * This is an interesting case. We do not check if context.origin is allowed
     * for current address and simply return saved chainId for this origin.
     * This seems to be okay because if the origin has no permissions at all, we will
     * default to ethereum anyway, but if the origin has permissions for an address which
     * is not current, it doesn't look like a problem to keep returning saved chainId
     * for this origin. In case the saved chainId is other than ethereum,
     * the dAPP will be able to make a conclusion that some _other_ address has some permissions,
     * but so what?
     */
    if (!context || !context.origin) {
      throw new Error('Unknown sender origin');
    }
    return this.wallet.getChainIdForOrigin({ origin: context.origin });
  }

  async net_version({ context, id }: PublicMethodParams) {
    const chainId = await this.eth_chainId({ context, id });
    return String(parseInt(chainId));
  }

  async eth_sendTransaction({
    params,
    context,
    id,
  }: PublicMethodParams<
    [
      IncomingTransaction,
      /* TODO: refactor to use {context} instead? */ { clientScope?: string }?
    ]
  >) {
    const currentAddress = this.wallet.ensureCurrentAddress();
    // NOTE: I switched to synchronous method in an attempt to
    // synchronously open sidepanel in response to a dapp request
    // because browser only allows to open sidepanel synchronously after
    // a user action. But currently I abandoned the idea of opening sidepanel
    // for dapp requests. Instead, we use sidepanel if it is already opened
    // So this sync method is not necessary.
    // NOTE:
    // There is another possible workaround to opening sidepanel but keeping these methods
    // asyncronous. We can synchronously open sidepanel with some loading UI,
    // and then later update it with the desired view by calling `.setOptions()` API.
    const currentWallet = this.wallet.getCurrentWalletSync({
      context: INTERNAL_SYMBOL_CONTEXT,
    });
    // TODO: should we check transaction.from instead of currentAddress?
    if (!this.wallet.allowedOrigin(context, currentAddress)) {
      throw new OriginNotAllowed();
    }
    const [transaction, { clientScope } = { clientScope: undefined }] = params;
    invariant(transaction, () => new InvalidParams());
    const isDeviceWallet = currentWallet && isDeviceAccount(currentWallet);
    const searchParams = new URLSearchParams({
      origin: context.origin,
      transaction: JSON.stringify(transaction),
    });
    if (clientScope) {
      searchParams.append('clientScope', clientScope);
    }

    await this.wallet.ensureTestnetModeForTx({
      transaction,
      initiator: context.origin,
      tabId: context.tabId || null,
    });

    return new Promise((resolve, reject) => {
      this.safeOpenDialogWindow(context.origin, {
        requestId: `${context.origin}:${id}`,
        route: '/sendTransaction',
        height: isDeviceWallet ? 800 : undefined,
        search: `?${searchParams}`,
        tabId: context.tabId || null,
        onResolve: (hash) => {
          resolve(hash);
        },
        onDismiss: () => {
          reject(new UserRejectedTxSignature());
        },
      });
    });
  }

  async eth_signTypedData_v4({
    context,
    params: [address, data],
    id,
  }: PublicMethodParams<[string, TypedData | string]>) {
    const currentAddress = this.wallet.ensureCurrentAddress();
    if (!this.wallet.allowedOrigin(context, currentAddress)) {
      throw new OriginNotAllowed();
    }
    if (normalizeAddress(address) !== normalizeAddress(currentAddress)) {
      throw new Error(
        // TODO?...
        `Address parameter is different from currently selected address. Expected: ${currentAddress}, received: ${address}`
      );
    }
    const stringifiedData =
      typeof data === 'string' ? data : JSON.stringify(data);
    const currentWallet = await this.wallet.uiGetCurrentWallet({
      context: INTERNAL_SYMBOL_CONTEXT,
    });
    const isDeviceWallet = currentWallet && isDeviceAccount(currentWallet);
    return new Promise((resolve, reject) => {
      this.safeOpenDialogWindow(context.origin, {
        requestId: `${context.origin}:${id}`,
        route: '/signTypedData',
        height: isDeviceWallet ? 800 : undefined,
        search: `?${new URLSearchParams({
          origin: context.origin,
          typedDataRaw: stringifiedData,
          method: 'eth_signTypedData_v4',
        })}`,
        tabId: context.tabId || null,
        onResolve: (signature) => {
          resolve(signature);
        },
        onDismiss: () => {
          reject(new UserRejectedTxSignature());
        },
      });
    });
  }

  async eth_signTypedData({ context: _context }: PublicMethodParams) {
    throw new MethodNotImplemented('eth_signTypedData: Not Implemented');
  }

  async eth_sign({ context: _context }: PublicMethodParams) {
    throw new MethodNotImplemented('eth_sign: Not Implemented');
  }

  async personal_sign({
    id,
    params,
    context,
  }: PublicMethodParams<
    [
      string,
      string,
      string,
      /* TODO: refactor to use {context} instead? */ { clientScope?: string }?
    ]
  >) {
    if (!params.length) {
      throw new InvalidParams();
    }
    const [
      shouldBeMessage,
      shouldBeAddress,
      _password,
      { clientScope } = { clientScope: undefined },
    ] = params;
    const currentAddress = this.wallet.ensureCurrentAddress();

    let address = '';
    let message = '';
    if (isEthereumAddress(shouldBeAddress)) {
      address = shouldBeAddress;
      message = shouldBeMessage;
    } else if (isEthereumAddress(shouldBeMessage)) {
      // specification obliges us to send [message, address] params in this particular order
      // https://web3js.readthedocs.io/en/v1.2.11/web3-eth-personal.html#id15
      // but some dapps send personal_sign params in wrong order
      address = shouldBeMessage;
      message = shouldBeAddress;
    } else {
      throw new Error(
        `Address is required for "personal_sign" method. Received [${params[0]}, ${params[1]}]`
      );
    }

    if (
      address &&
      normalizeAddress(address) !== normalizeAddress(currentAddress)
    ) {
      throw new Error(
        // TODO?...
        `Address parameter is different from currently selected address. Received: ${address}`
      );
    }
    if (!this.wallet.allowedOrigin(context, currentAddress)) {
      throw new OriginNotAllowed();
    }

    const currentWallet = await this.wallet.uiGetCurrentWallet({
      context: INTERNAL_SYMBOL_CONTEXT,
    });
    const isDeviceWallet = currentWallet && isDeviceAccount(currentWallet);
    const searchParams = new URLSearchParams({
      method: 'personal_sign',
      origin: context.origin,
      message,
    });
    if (clientScope) {
      searchParams.append('clientScope', clientScope);
    }
    return new Promise((resolve, reject) => {
      this.safeOpenDialogWindow(context.origin, {
        requestId: `${context.origin}:${id}`,
        route: '/signMessage',
        height: isDeviceWallet ? 800 : undefined,
        search: `?${searchParams}`,
        tabId: context.tabId || null,
        onResolve: (signature) => {
          resolve(signature);
        },
        onDismiss: () => {
          reject(new UserRejectedTxSignature());
        },
      });
    });
  }

  async wallet_switchEthereumChain({
    params,
    context,
    id,
  }: PublicMethodParams<[{ chainId?: string | number }]>): Promise<
    null | object
  > {
    const currentAddress = this.wallet.readCurrentAddress();
    if (!context || !context.origin) {
      throw new OriginNotAllowed();
    }
    invariant(params[0], () => new InvalidParams());
    const { origin } = context;
    const { chainId: chainIdParameter } = params[0];
    invariant(
      chainIdParameter,
      'ChainId is a required param for wallet_switchEthereumChain method'
    );
    const chainId = normalizeChainId(chainIdParameter);

    const tabId = context.tabId || null;
    await this.wallet.ensureTestnetModeForChainId(chainId, tabId);

    const preferences = await this.wallet.getPreferences({
      context: INTERNAL_SYMBOL_CONTEXT,
    });
    const networksStore = getNetworksStore(preferences);
    const networks = await networksStore.loadNetworksByChainId(chainId);
    if (
      !currentAddress ||
      !this.wallet.allowedOrigin(context, currentAddress)
    ) {
      const chain = networks.getChainById(chainId);
      return new Promise((resolve, reject) => {
        this.safeOpenDialogWindow(origin, {
          requestId: `${context.origin}:${id}`,
          route: '/switchEthereumChain',
          search: `?origin=${origin}&chainId=${chainId}`,
          tabId: context.tabId || null,
          onResolve: () => {
            this.wallet.setChainForOrigin({ evmChain: chain, origin });
            this.wallet.addVisitedEthereumChainInternal(chain);
            setTimeout(() => resolve(null));
          },
          onDismiss: () => {
            reject(new UserRejected('User Rejected the Request'));
          },
        });
      });
    }

    const currentChainIdForThisOrigin = await this.wallet.getChainIdForOrigin({
      origin,
    });
    if (chainId === currentChainIdForThisOrigin) {
      return null;
    }
    try {
      const chain = networks.getChainById(chainId);
      // Switch immediately and return success
      this.wallet.setChainForOrigin({ evmChain: chain, origin });
      this.wallet.addVisitedEthereumChainInternal(chain);
      // return null in next tick to give provider enough time to change chainId property
      return new Promise((resolve) => {
        setTimeout(() => resolve(null));
      });
    } catch (error) {
      emitter.emit('switchChainError', chainId, origin, error);
      throw new SwitchChainError(`Chain not configured: ${chainIdParameter}`);
    }
  }

  async wallet_getWalletNameFlags({
    context: _context,
    params: { origin },
  }: PublicMethodParams<{ origin: string }>) {
    const preferences = await this.wallet.getGlobalPreferences({
      /**
       * NOTE: we're not checking `context` param here and use
       * INTERNAL_SYMBOL_CONTEXT, because preferences.walletNameFlags are
       * supposed to work even before the user has given permissions
       * to the DApp. `walletNameFlags` are about global ethereum object behavior
       * and do not contain any private data
       */
      context: INTERNAL_SYMBOL_CONTEXT,
    });
    return getWalletNameFlagsByOrigin(preferences, origin);
  }

  async wallet_registerEip6963Support({ context }: PublicMethodParams) {
    invariant(context?.origin, 'This method requires origin');
    emitter.emit('eip6963SupportDetected', { origin: context.origin });
  }

  async wallet_getGlobalPreferences({ context: _context }: PublicMethodParams) {
    return this.wallet.getGlobalPreferences({
      /** wallet.getGlobalPreferences does not return any private data */
      context: INTERNAL_SYMBOL_CONTEXT,
    });
  }

  private generatePermissionResponse(
    params: [{ [name: string]: unknown }]
  ): Web3WalletPermission[] {
    if (params?.[0] && 'eth_accounts' in params[0]) {
      return [{ parentCapability: 'eth_accounts' }];
    } else {
      throw new InvalidParams();
    }
  }

  private getIsAllowedOrigin({ context }: Pick<PublicMethodParams, 'context'>) {
    const currentAddress = this.wallet.readCurrentAddress();
    if (!currentAddress) {
      return false;
    }
    return this.wallet.allowedOrigin(context, currentAddress);
  }

  async wallet_requestPermissions({
    id,
    context,
    params,
  }: PublicMethodParams<[{ [name: string]: unknown }]>): Promise<
    Web3WalletPermission[]
  > {
    await this.eth_requestAccounts({ context, id, params: [] });
    return this.generatePermissionResponse(params);
  }

  async wallet_getPermissions({
    context,
  }: PublicMethodParams): Promise<Web3WalletPermission[]> {
    if (this.getIsAllowedOrigin({ context })) {
      return [{ parentCapability: 'eth_accounts' }];
    } else {
      return [];
    }
  }

  async wallet_addEthereumChain({
    id,
    context,
    params,
  }: PublicMethodParams<[AddEthereumChainParameter]>) {
    invariant(context?.origin, 'This method requires origin');
    invariant(params[0], () => new InvalidParams());
    const { origin } = context;
    const { chainId: chainIdParameter } = params[0];
    const chainId = normalizeChainId(chainIdParameter);
    const tabId = context.tabId || null;
    await this.wallet.ensureTestnetModeForChainId(chainId, tabId);
    const normalizedParams = { ...params[0], chainId };
    const preferences = await this.wallet.getPreferences({
      context: INTERNAL_SYMBOL_CONTEXT,
    });
    const networksStore = getNetworksStore(preferences);
    const networks = await networksStore.loadNetworksByChainId(chainId);
    return new Promise((resolve, reject) => {
      if (networks.hasMatchingConfig(normalizedParams)) {
        resolve(null); // null indicates success as per spec
      } else {
        this.safeOpenDialogWindow(origin, {
          requestId: `${origin}:${id}`,
          route: '/addEthereumChain',
          search: `?${new URLSearchParams({
            origin,
            addEthereumChainParameter: JSON.stringify(normalizedParams),
          })}`,
          tabId: context.tabId || null,
          onResolve: () => {
            resolve(null); // null indicates success as per spec
          },
          onDismiss: () => {
            reject(new UserRejected());
          },
        });
      }
    }).then(() => {
      // Automatically switch dapp to this network because this is what most dapps seem to expect
      return this.wallet_switchEthereumChain({
        id,
        context,
        params: [{ chainId: normalizedParams.chainId }],
      });
    });
  }

  async wallet_isKnownDapp({
    context,
  }: PublicMethodParams<{ origin: string }>) {
    invariant(context?.origin, 'This method requires origin');
    return isKnownDapp({ origin: context.origin });
  }
}
