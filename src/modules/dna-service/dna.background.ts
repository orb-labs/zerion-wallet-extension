import { WalletOrigin } from 'src/shared/WalletOrigin';
import ky from 'ky';
import omit from 'lodash/omit';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { createNanoEvents } from 'nanoevents';
import { ethers } from 'ethers';
import { version } from 'src/shared/packageVersion';
import { BrowserStorage } from 'src/background/webapis/storage';
import { normalizeAddress } from 'src/shared/normalizeAddress';
import { emitter } from 'src/background/events';
import { isReadonlyContainer } from 'src/shared/types/validators';
import type { Wallet } from 'src/shared/types/Wallet';
import { INTERNAL_SYMBOL_CONTEXT } from 'src/background/Wallet/Wallet';
import type { Account } from 'src/background/account/Account';
import { ensureSolanaResult } from '../shared/transactions/helpers';
import type { DnaAction } from './types';

const REGISTER_ALL_WALLETS_INVOKED_KEY = 'registerAllWalletsInvoked-14-10-2024';
const ACTION_QUEUE_KEY = 'actionDnaQueue-22-12-2021';
const DNA_API_ENDPOINT = 'https://dna.zerion.io/api/v1';

type DnaActionWithTimestamp = DnaAction & { timestamp: number };

export const dnaServiceEmitter = createNanoEvents<{
  registerSuccess: (action: DnaAction) => void;
  registerError: (error: Error, action: DnaAction) => void;
}>();

const ONE_DAY = 1000 * 60 * 60 * 24;

export class DnaService {
  private readonly getWallet: () => Wallet;
  private sendingInProgress: boolean;

  constructor({ getWallet }: { getWallet: () => Wallet }) {
    this.getWallet = getWallet;
    this.sendingInProgress = false;
  }

  async pushAction(action: DnaAction) {
    const currentQueue = await BrowserStorage.get<DnaActionWithTimestamp[]>(
      ACTION_QUEUE_KEY
    );
    await BrowserStorage.set(ACTION_QUEUE_KEY, [
      ...(currentQueue || []),
      { ...action, timestamp: Date.now() },
    ]);
    return new Promise<void>((resolve, reject) => {
      this.tryRegisterAction();
      const unsub = [
        dnaServiceEmitter.on('registerSuccess', (registeredAction) => {
          if (action.id === registeredAction.id) {
            unsub.forEach((un) => un());
            resolve();
          }
        }),
        dnaServiceEmitter.on('registerError', (error) => {
          unsub.forEach((un) => un());
          reject(error);
        }),
      ];
    });
  }

  private async popAction() {
    const currentQueue = await BrowserStorage.get<DnaActionWithTimestamp[]>(
      ACTION_QUEUE_KEY
    );
    currentQueue?.shift();
    await BrowserStorage.set(ACTION_QUEUE_KEY, currentQueue);
    this.tryRegisterAction();
  }

  private async takeFirstRecentAction() {
    const currentQueue = await BrowserStorage.get<DnaActionWithTimestamp[]>(
      ACTION_QUEUE_KEY
    );
    if (!currentQueue?.length) {
      return null;
    }
    const currentTime = Date.now();
    while (
      currentQueue[0] &&
      (!currentQueue[0].timestamp ||
        currentTime - currentQueue[0].timestamp > ONE_DAY)
    ) {
      currentQueue.shift();
    }
    await BrowserStorage.set(ACTION_QUEUE_KEY, currentQueue);
    return omit(currentQueue[0], 'timestamp');
  }

  private async registerAction(action: DnaAction) {
    this.sendingInProgress = true;
    return new Promise<{ success: boolean }>((resolve) => {
      ky.post(`${DNA_API_ENDPOINT}/actions`, {
        retry: {
          // increase retry attempt count
          limit: 3,
          // enable retry for POST
          methods: ['post'],
        },
        // random header for backend scheme validation
        headers: { 'Z-Proof': uuidv4() },
        body: JSON.stringify(action),
      })
        .json()
        .then(() => {
          this.popAction();
          this.sendingInProgress = false;
          dnaServiceEmitter.emit('registerSuccess', action);
          resolve({ success: true });
        })
        .catch((error) => {
          this.sendingInProgress = false;
          dnaServiceEmitter.emit('registerError', error, action);
          resolve({ success: false });
        });
    });
  }

  async tryRegisterAction() {
    if (this.sendingInProgress) {
      return { success: false };
    }
    const action = await this.takeFirstRecentAction();
    if (!action) {
      return { success: false };
    }
    return this.registerAction(action);
  }

  async getPromoteDnaSigningMessage({
    params: { collectionName, tokenName },
  }: {
    params: {
      collectionName: string;
      tokenName: string;
    };
  }) {
    const actionId = uuidv4();
    const rawMessage = `Make ${collectionName} #${tokenName} primary\n\n${actionId}`;
    const message = ethers.hexlify(ethers.toUtf8Bytes(rawMessage));
    return { message, actionId };
  }

  async promoteDnaToken({
    params,
  }: {
    params: {
      address: string;
      actionId: string;
      tokenName: string;
      signature: string;
    };
  }) {
    return this.pushAction({
      address: normalizeAddress(params.address),
      id: params.actionId,
      payload: {
        promoteToken: {
          generation: 'OnePointO',
          id: params.tokenName,
          signature: params.signature,
        },
      },
    });
  }

  async registerWallet({
    params,
  }: {
    params: {
      address: string;
      origin?: WalletOrigin;
    };
  }) {
    const { address, origin = WalletOrigin.imported } = params;
    const actionId = uuidv4();
    return this.pushAction({
      address: normalizeAddress(address),
      id: actionId,
      payload: {
        registerWallet: {
          imported: origin === WalletOrigin.imported,
          platform: 'extension',
          version,
        },
      },
    });
  }

  async registerTransaction({
    address,
    hash,
    chain,
  }: {
    address: string;
    hash: string;
    chain: string;
  }) {
    const actionId = uuidv5(
      `sign(${chain}, ${hash})`,
      'ddf8b936-fec5-48b3-a258-a73dcd897f0a'
    );

    return this.pushAction({
      address: normalizeAddress(address),
      id: actionId,
      payload: {
        signTx: {
          network: chain,
          platform: 'extension',
          txHash: hash,
          version,
        },
      },
    });
  }

  async gm({ params }: { params: { address: string } }) {
    const actionId = uuidv4();
    const { address } = params;
    return this.pushAction({
      address: normalizeAddress(address),
      id: actionId,
      payload: {
        gm: {},
      },
    });
  }

  async claimPerk({
    params,
  }: {
    params: {
      actionId: string;
      address: string;
      tokenId: string;
      backgroundId: number;
      signature: string;
    };
  }) {
    const { actionId, address, tokenId, backgroundId, signature } = params;
    return this.pushAction({
      address: normalizeAddress(address),
      id: actionId,
      payload: {
        claimPerk: {
          extensionBackground: {
            tokenId,
            backgroundId,
            signature,
          },
        },
      },
    });
  }

  async developerOnly_resetActionQueue() {
    return BrowserStorage.set(ACTION_QUEUE_KEY, []);
  }

  async registerAllWallets() {
    // To make sure referral codes are generated for new wallets we need to call 'registerWallet' on the Zerion DNA Service.
    // Existing "owned" wallets (wallets with provider) require to have referral codes as well,
    // but the backend lacks sufficient data to assign them.
    //
    // Additionally, re-registration is crucial due to a previous backend error:
    // Zerion DNA Service expected a version prefix 'v' for 'registerWallet' requests, which we were not including.
    // This backend issue has since been resolved, but as a result,
    // wallets previously registered without 'v' are effectively unregistered.
    // To handle this, we have to re-register all existing wallets.

    const hasBeenFinished = await BrowserStorage.get<boolean>(
      REGISTER_ALL_WALLETS_INVOKED_KEY
    );
    if (hasBeenFinished) {
      return;
    }

    const wallet = this.getWallet();
    const walletGroups = await wallet.uiGetWalletGroups({
      context: INTERNAL_SYMBOL_CONTEXT,
    });

    const ownedAddressesWithGroupOrigins =
      walletGroups
        ?.filter((group) => !isReadonlyContainer(group.walletContainer))
        ?.flatMap((group) =>
          group.walletContainer.wallets.map((wallet) => ({
            address: wallet.address,
            origin: group.origin || undefined,
          }))
        ) || [];

    const walletRegistrationRequests = ownedAddressesWithGroupOrigins.map(
      ({ address, origin }) =>
        this.registerWallet({ params: { address, origin } })
    );

    const results = await Promise.allSettled(walletRegistrationRequests);
    const hasRejectedRequests = results.some(
      (result) => result.status === 'rejected'
    );
    const hasFulfilledRequests = results.some(
      (result) => result.status === 'fulfilled'
    );

    if (hasFulfilledRequests && !hasRejectedRequests) {
      await BrowserStorage.set(REGISTER_ALL_WALLETS_INVOKED_KEY, true);
    }
  }

  initialize({ account }: { account: Account }) {
    this.registerAllWallets();
    account.on('authenticated', this.registerAllWallets.bind(this));
    emitter.on('walletCreated', async ({ walletContainer, origin }) => {
      if (isReadonlyContainer(walletContainer)) {
        return;
      }
      for (const wallet of walletContainer.wallets) {
        await this.registerWallet({
          params: { address: wallet.address, origin },
        });
      }
    });
    emitter.on('transactionSent', (data, { chain }) => {
      if (data.evm) {
        this.registerTransaction({
          address: data.evm.from,
          hash: data.evm.hash,
          chain,
        });
      } else if (data.solana) {
        const result = ensureSolanaResult(data);
        this.registerTransaction({
          address: result.publicKey,
          hash: result.signature,
          chain,
        });
      } else {
        throw new Error('Unexpected transaction type');
      }
    });
  }
}
