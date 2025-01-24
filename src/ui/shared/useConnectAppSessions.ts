import { useBulkConnectAppSessions } from '@orb-labs/orby-react';
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPermissionsWithWallets } from 'src/ui/shared/requests/getPermissionsWithWallets';
import type { ConnectedSiteItem } from 'src/ui/shared/requests/getPermissionsWithWallets';

export function useConnectAppSessions() {
  console.log('useConnectAppSessions 1');
  const { data: allConnectedSites, isPending } = useQuery({
    queryKey: ['getPermissionsWithWallets'],
    queryFn: getPermissionsWithWallets,
    throwOnError: true,
  });

  console.log('useConnectAppSessions 2', isPending, allConnectedSites);
  const activeSessions = React.useMemo(() => {
    if (isPending || !allConnectedSites) {
      return [];
    }

    return allConnectedSites?.map(
      ({ origin, addresses }: ConnectedSiteItem) => {
        return { host: origin, address: addresses[0] as `0x${string}` };
      }
    );
  }, [allConnectedSites, isPending]);

  console.log('activeSessions', activeSessions);

  const { isLoading, isConnected } = useBulkConnectAppSessions(activeSessions);
  return { isLoading, isConnected };
}
