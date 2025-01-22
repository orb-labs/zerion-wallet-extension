import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { persistentQuery } from 'src/ui/shared/requests/queryClientPersistence';
import { ZerionAPI } from '../zerion-api.client';
import type { Params } from '../requests/wallet-get-portfolio';
import type { BackendSourceParams } from '../shared';

export function useWalletPortfolio(
  params: Params,
  { source }: BackendSourceParams,
  {
    enabled = true,
    shouldKeepPreviousData = false,
    refetchInterval,
  }: {
    enabled?: boolean;
    shouldKeepPreviousData?: boolean;
    refetchInterval?: number;
  } = {}
) {
  return useQuery({
    queryKey: persistentQuery(['walletGetPortfolio', params, source]),
    queryFn: () => ZerionAPI.walletGetPortfolio(params, { source }),
    enabled,
    placeholderData: shouldKeepPreviousData ? keepPreviousData : undefined,
    staleTime: 20000,
    refetchInterval,
  });
}
