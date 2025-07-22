import { useRemoteConfigValue } from 'src/modules/remote-config/useRemoteConfigValue';
import { useMemo } from 'react';
import _ from 'lodash';

export function useIsChainAbstractionFeatureFlagEnabled() {
  const { data: chainAbstraction } = useRemoteConfigValue(
    'chain_abstraction_enabled'
  );

  return useMemo(() => {
    return (!_.isUndefined(chainAbstraction) && chainAbstraction) || true;
  }, [chainAbstraction]);
}
