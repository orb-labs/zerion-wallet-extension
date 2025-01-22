import { useQuery } from '@tanstack/react-query';
import { walletPort } from 'src/ui/shared/channels';

export function usePrivateKey(address: string) {
  return useQuery({
    queryKey: ['getPrivateKey', address],
    queryFn: () => walletPort.request('getPrivateKey', { address }),
    throwOnError: false,
    gcTime: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
