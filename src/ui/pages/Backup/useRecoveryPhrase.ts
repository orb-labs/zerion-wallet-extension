import { useQuery } from '@tanstack/react-query';
import { invariant } from 'src/shared/invariant';
import { walletPort } from 'src/ui/shared/channels';

export function usePendingRecoveryPhrase({ enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: ['getPendingRecoveryPhrase'],
    queryFn: () => walletPort.request('getPendingRecoveryPhrase'),
    enabled,
    retry: 0,
    gcTime: 0 /** sensitive value, prevent from being cached */,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    throwOnError: false,
  });
}

export function useRecoveryPhrase({
  groupId,
  enabled,
}: {
  groupId: string | null;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: ['getRecoveryPhrase', groupId],
    queryFn: async () => {
      invariant(groupId, 'groupId is not set');
      const mnemonic = await walletPort.request('getRecoveryPhrase', {
        groupId,
      });
      return mnemonic.phrase;
    },
    enabled,
    retry: 0,
    gcTime: 0 /** sensitive value, prevent from being cached */,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    throwOnError: false,
  });
}
