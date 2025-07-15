import React from 'react';
import { TextLine } from 'src/ui/components/address-action/TextLine';
import { Surface } from 'src/ui/ui-kit/Surface';
import { VStack } from 'src/ui/ui-kit/VStack';
import type { InterpretInput } from 'src/modules/ethereum/transactions/types';
import { PageTop } from 'src/ui/components/PageTop';
import { TokenStateSection } from 'src/ui/components/TokenStateSection';
import type { OperationSet } from '@orb-labs/orby-core';

export function TypedDataAdvancedView({
  data,
  operationSet,
}: {
  data: InterpretInput;
  operationSet?: OperationSet;
}) {
  return (
    <>
      <PageTop />
      <Surface padding={16} style={{ backgroundColor: 'var(--neutral-100)' }}>
        <VStack gap={16}>
          {operationSet && (
            <>
              <TokenStateSection
                title="Input Tokens"
                tokens={operationSet.inputState}
              />
              <TokenStateSection
                title="Output Tokens"
                tokens={operationSet.outputState}
              />
            </>
          )}
          {data.sections.flatMap(({ blocks }, index) =>
            blocks.map(({ name, value }) => (
              <TextLine
                wrap={true}
                key={`${name}-${index}`}
                label={name}
                value={value}
              />
            ))
          )}
        </VStack>
      </Surface>
    </>
  );
}
