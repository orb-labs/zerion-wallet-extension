import { useMemo } from 'react';
import _ from 'lodash';
import { NetworkSelectValue } from 'src/modules/networks/NetworkSelectValue';
import { useOrby } from '@orb-labs/orby-react';
import { usePreferences } from 'src/ui/features/preferences';

export function useIsChainAbstractionEnabled() {
  const { accountCluster } = useOrby();
  const { preferences } = usePreferences();

  return useMemo(() => {
    return (
      accountCluster?.isChainAbstractionEnabled &&
      preferences?.selectedChain === NetworkSelectValue.Unified
    );
  }, [accountCluster?.isChainAbstractionEnabled, preferences?.selectedChain]);
}
