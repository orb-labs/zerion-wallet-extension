import React from 'react';
import { Surface } from 'src/ui/ui-kit/Surface';
import { UIText } from 'src/ui/ui-kit/UIText';
import { VStack } from 'src/ui/ui-kit/VStack';
import { HStack } from 'src/ui/ui-kit/HStack';
import type { State } from '@orb-labs/orby-core';
import { TokenIcon } from 'src/ui/ui-kit/TokenIcon';
import { Media } from 'src/ui/ui-kit/Media';
import { formatTokenValue } from 'src/shared/units/formatTokenValue';
import { AssetQuantity } from 'src/ui/components/AssetQuantity';
import { BigNumber } from 'bignumber.js';

export function TokenStateSection({
  title,
  tokens,
}: {
  title: string;
  tokens: State | undefined;
}) {
  const fungibleTokens = tokens?.getFungibleTokens();
  if (!fungibleTokens) {
    return null;
  }

  if (fungibleTokens.length === 0) {
    return (
      <Surface>
        <VStack gap={12} style={{ paddingBlock: 24, paddingLeft: 16 }}>
          <UIText kind="small/regular" color="var(--neutral-500)">
            {title}
          </UIText>
          <UIText kind="body/regular" color="white">
            No tokens moving
          </UIText>
        </VStack>
      </Surface>
    );
  }

  return (
    <Surface>
      <VStack gap={12}>
        <UIText kind="small/regular" color="var(--neutral-500)">
          {title}
        </UIText>
        {fungibleTokens.map((tokenAmount, index) => {
          // Convert raw amount to decimal based on token decimals
          const rawAmount = BigNumber(tokenAmount.toRawAmount().toString());
          const decimals = tokenAmount.token.currency().decimals;
          const decimalAmount = rawAmount.dividedBy(
            BigNumber(10).pow(decimals)
          );

          return (
            <Media
              key={`${tokenAmount.token.identifier()}-${index}`}
              gap={12}
              vGap={0}
              image={
                <TokenIcon
                  size={36}
                  src={tokenAmount.token.currency().logoUrl}
                  symbol={tokenAmount.token.currency().symbol}
                  title={tokenAmount.token.currency().name}
                />
              }
              text={
                <UIText kind="headline/h3">
                  <HStack gap={4} alignItems="center">
                    <AssetQuantity commonQuantity={decimalAmount} />
                    <span>{tokenAmount.token.currency().symbol}</span>
                  </HStack>
                </UIText>
              }
              detailText={
                <UIText kind="small/regular" color="var(--neutral-500)">
                  {formatTokenValue(
                    decimalAmount,
                    tokenAmount.token.currency().symbol
                  )}
                </UIText>
              }
            />
          );
        })}
      </VStack>
    </Surface>
  );
}
