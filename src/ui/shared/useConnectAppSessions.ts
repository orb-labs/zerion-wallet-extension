import { useBulkConnectAppSessions } from '@orb-labs/orby-react';
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPermissionsWithWallets } from 'src/ui/shared/requests/getPermissionsWithWallets';
import type { ConnectedSiteItem } from 'src/ui/shared/requests/getPermissionsWithWallets';

export function useConnectAppSessions() {
  const { data: allConnectedSites, isPending } = useQuery({
    queryKey: ['getPermissionsWithWallets'],
    queryFn: getPermissionsWithWallets,
    throwOnError: true,
  });

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

  const { isLoading, isConnected } = useBulkConnectAppSessions(activeSessions);
  return { isLoading, isConnected };
}
