import type { BridgeFormState } from 'src/ui/pages/BridgeForm/types';
import type { SwapFormState } from 'src/ui/pages/SwapForm/shared/SwapFormState';
import { useQuotes2 } from './useQuotes';

type FormStateWithSort = SwapFormState | BridgeFormState;

interface UseSortedQuotesParams {
  address: string;
  currency: string;
  formState: FormStateWithSort;
  enabled?: boolean;
}

/**
 * Hook that returns quotes sorted by amount and time
 * This allows components to switch between different sorting methods
 * without making additional API calls
 */
export function useSortedQuotes(params: UseSortedQuotesParams) {
  return {
    quotesByAmount: useQuotes2({
      ...params,
      formState: { ...params.formState, sort: '1' },
    }),
    quotesByTime: useQuotes2({
      ...params,
      formState: { ...params.formState, sort: '2' },
    }),
  };
}
