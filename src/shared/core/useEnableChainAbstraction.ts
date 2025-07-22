import { useMemo } from 'react';
import _ from 'lodash';

import { NetworkSelectValue } from 'src/modules/networks/NetworkSelectValue';
import { useEnableChainAbstractionOnAccountCluster } from '@orb-labs/orby-react';
import { useIsChainAbstractionFeatureFlagEnabled } from './useIsChainAbstractionFeatureFlagEnabled';

export function useEnableChainAbstraction(chain: string) {
  const chainAbstractionEnabled = useIsChainAbstractionFeatureFlagEnabled();

  const enableChainAbstraction = useMemo(() => {
    return chain == NetworkSelectValue.Unified && chainAbstractionEnabled;
  }, [chain, chainAbstractionEnabled]);

  const { isSuccessful } = useEnableChainAbstractionOnAccountCluster(
    enableChainAbstraction
  );

  return useMemo(() => {
    return isSuccessful && enableChainAbstraction;
  }, [isSuccessful, enableChainAbstraction]);
}
