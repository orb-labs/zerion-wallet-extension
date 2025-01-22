import { useQuery } from '@tanstack/react-query';
import { walletPort } from 'src/ui/shared/channels';

export function usePhishingDefenceStatus(origin?: string | null) {
  return useQuery({
    queryKey: ['wallet/getDappSecurityStatus', origin],
    queryFn: () =>
      walletPort.request('getDappSecurityStatus', {
        url: origin,
      }),
    gcTime: 0,
    refetchInterval: (data) =>
      data?.state?.status === 'pending' ? 1000 : false,
  });
}
