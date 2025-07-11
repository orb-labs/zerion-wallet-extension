import React, { useId, useRef } from 'react';
import type { BareWallet } from 'src/shared/types/BareWallet';
import type { DeviceAccount } from 'src/shared/types/Device';
import type { ExternallyOwnedAccount } from 'src/shared/types/ExternallyOwnedAccount';
import { SurfaceList, type Item } from 'src/ui/ui-kit/SurfaceList';
import { UIText } from 'src/ui/ui-kit/UIText';
import { UnstyledButton } from 'src/ui/ui-kit/UnstyledButton';
import { HStack } from 'src/ui/ui-kit/HStack';
import { Media } from 'src/ui/ui-kit/Media';
import { IsConnectedToActiveTab } from 'src/ui/shared/requests/useIsConnectedToActiveTab';
import { WalletAvatar } from 'src/ui/components/WalletAvatar';
import { WalletDisplayName } from 'src/ui/components/WalletDisplayName';
import { PortfolioValue } from 'src/ui/shared/requests/PortfolioValue';
import { NeutralDecimals } from 'src/ui/ui-kit/NeutralDecimals';
import { formatCurrencyToParts } from 'src/shared/units/formatCurrencyValue';
import { middot, NBSP } from 'src/ui/shared/typography';
import CheckIcon from 'jsx:src/ui/assets/check.svg';
import { WalletSourceIcon } from 'src/ui/components/WalletSourceIcon';
import { truncateAddress } from 'src/ui/shared/truncateAddress';
import { WalletNameType } from 'src/ui/shared/useProfileName';
import { CopyButton } from 'src/ui/components/CopyButton';
import { useCurrency } from 'src/modules/currency/useCurrency';
import { normalizeAddress } from 'src/shared/normalizeAddress';
import { VStack } from 'src/ui/ui-kit/VStack';
import { getAddressType } from 'src/shared/wallet/classifiers';
import * as styles from './styles.module.css';

function WalletListItem({
  wallet,
  groupId,
  showAddressValues,
  useCssAnchors,
  isSelected,
  renderFooter,
  ...buttonProps
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  wallet: ExternallyOwnedAccount;
  groupId: string;
  showAddressValues: boolean;
  useCssAnchors: boolean;
  isSelected: boolean;
  renderFooter: (() => React.ReactNode) | null;
}) {
  const id = useId();
  const { currency } = useCurrency();
  // colons are invalid for anchor-name CSS property
  const anchorName = `--button-slot-${id.replaceAll(':', '')}`;
  const COPY_BUTTON_SIZE = 20;
  const copyButtonRef = useRef<HTMLButtonElement | null>(null);
  const copyButton = (
    <CopyButton
      title="Copy Address"
      textToCopy={wallet.address}
      onClick={(event) => {
        if (!useCssAnchors) {
          event.stopPropagation();
        }
      }}
      buttonRef={copyButtonRef}
      size={16}
      btnStyle={{
        padding: 0,
        display: 'block',
        ['--button-text' as string]:
          'var(--copy-button-text-color, var(--neutral-500))',
      }}
      tooltipPosition="center-bottom"
      tooltipContent="Address Copied"
      style={{
        verticalAlign: 'middle',
        ...(useCssAnchors
          ? {
              position: 'absolute',
              ['positionAnchor' as string]: anchorName,
              ['positionArea' as string]: 'center',
            }
          : undefined),
      }}
    />
  );
  const ecosystemPrefix =
    getAddressType(wallet.address) === 'evm' ? 'Eth' : 'Sol';

  return (
    <>
      <UnstyledButton
        className={styles.wallet}
        style={{
          borderRadius: 20,
          width: '100%',
          marginBlock: 4,
        }}
        {...buttonProps}
      >
        <VStack gap={0}>
          <HStack
            gap={4}
            justifyContent="space-between"
            alignItems="center"
            style={{ padding: 12 }}
          >
            <Media
              vGap={0}
              image={
                <IsConnectedToActiveTab
                  address={wallet.address}
                  render={({ data: isConnected }) => (
                    <WalletAvatar
                      address={wallet.address}
                      size={40}
                      active={Boolean(isConnected)}
                      borderRadius={4}
                      icon={
                        <WalletSourceIcon
                          address={wallet.address}
                          groupId={groupId}
                          style={{ width: 16, height: 16 }}
                        />
                      }
                    />
                  )}
                />
              }
              text={
                <UIText kind="small/regular">
                  <WalletDisplayName
                    wallet={wallet}
                    render={(data) => (
                      <>
                        <span
                          style={{
                            wordBreak: 'break-all',
                            verticalAlign: 'middle',
                          }}
                        >
                          {`${
                            data.type !== WalletNameType.domain
                              ? `${ecosystemPrefix} ${middot} `
                              : ''
                          }${data.value}`}
                        </span>
                        {showAddressValues &&
                        data.type !== WalletNameType.address ? (
                          <>
                            <span
                              className={styles.addressHint}
                              style={{
                                color: 'var(--neutral-500)',
                                verticalAlign: 'middle',
                              }}
                              onClick={(event) => {
                                /**
                                 * This is only a helper to invoke click of the CopyButton
                                 * when the address value is clicked. Therefore it's okay to
                                 * put onClick on the span here as screenreader and keyboard users
                                 * will be able to interact with the actual copy button.
                                 * The reason not to put text inside the CopyButton is that when using
                                 * CSS Anchors we cannot make the anchored element wrap to the new line
                                 * when there's not enough space for it in the slot.
                                 */
                                if (copyButtonRef.current) {
                                  event.stopPropagation();
                                  copyButtonRef.current.click();
                                }
                              }}
                            >
                              {` · ${truncateAddress(wallet.address, 5)}`}
                            </span>
                          </>
                        ) : null}{' '}
                        {useCssAnchors ? (
                          <span
                            // This is a "slot" where copyButton will visually appear
                            style={{
                              display: 'inline-block',
                              width: COPY_BUTTON_SIZE,
                              height: COPY_BUTTON_SIZE,
                              ['anchorName' as string]: anchorName,
                              verticalAlign: 'bottom',
                            }}
                          ></span>
                        ) : (
                          copyButton
                        )}
                      </>
                    )}
                  />
                </UIText>
              }
              detailText={
                <PortfolioValue
                  address={wallet.address}
                  render={(query) => (
                    <UIText kind="headline/h3">
                      {query.data ? (
                        <NeutralDecimals
                          parts={formatCurrencyToParts(
                            query.data.data?.totalValue || 0,
                            'en',
                            currency
                          )}
                        />
                      ) : (
                        NBSP
                      )}
                    </UIText>
                  )}
                />
              }
            />
            {isSelected ? (
              <CheckIcon style={{ width: 24, height: 24 }} />
            ) : null}
          </HStack>
          {renderFooter ? renderFooter() : null}
        </VStack>
      </UnstyledButton>
      {useCssAnchors ? copyButton : null}
    </>
  );
}

type AnyWallet = ExternallyOwnedAccount | BareWallet | DeviceAccount;

interface WalletGroupInfo {
  id: string;
  walletContainer: {
    wallets: AnyWallet[];
  };
}

export function WalletList({
  walletGroups,
  selectedAddress,
  showAddressValues,
  renderItemFooter,
  onSelect,
  predicate,
}: {
  walletGroups: WalletGroupInfo[];
  selectedAddress: string;
  showAddressValues: boolean;
  renderItemFooter?: ({
    group,
    wallet,
  }: {
    group: WalletGroupInfo;
    wallet: AnyWallet;
  }) => React.ReactNode;
  onSelect(wallet: AnyWallet): void;
  predicate?: (item: AnyWallet) => boolean;
}) {
  const items: Item[] = [];
  /**
   * If CSS anchor positioning is supported, we use it to avoid
   * nesting buttons, which is invalid per html spec, but still works ¯\_(ツ)_/¯
   */
  // TODO: enable check when Chrome bug with CSS Anchors is fixed
  const supportsCssAnchor = CSS.supports('anchor-name: --name');
  for (const group of walletGroups) {
    for (const wallet of group.walletContainer.wallets) {
      if (predicate && !predicate(wallet)) {
        continue;
      }
      const key = `${group.id}-${wallet.address}`;
      items.push({
        key,
        isInteractive: true,
        pad: false,
        component: (
          <WalletListItem
            onClick={() => onSelect(wallet)}
            wallet={wallet}
            groupId={group.id}
            useCssAnchors={supportsCssAnchor}
            showAddressValues={showAddressValues}
            isSelected={
              normalizeAddress(wallet.address) ===
              normalizeAddress(selectedAddress)
            }
            renderFooter={
              renderItemFooter
                ? () => renderItemFooter({ group, wallet })
                : null
            }
          />
        ),
      });
    }
  }

  return <SurfaceList items={items} style={{ padding: 0 }} />;
}
