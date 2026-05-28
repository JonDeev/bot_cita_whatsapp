import { useQuery } from '@tanstack/react-query';
import { getLiveFeed, getOverview } from './overview.api';

export const overviewQueryKey = ['admin', 'overview'] as const;
export const liveFeedQueryKey = ['admin', 'live-feed'] as const;

export function useOverviewQuery() {
  return useQuery({
    queryKey: overviewQueryKey,
    queryFn: getOverview,
    refetchInterval: 120_000,
  });
}

export function useLiveFeedQuery() {
  return useQuery({
    queryKey: liveFeedQueryKey,
    queryFn: getLiveFeed,
    refetchInterval: 60_000,
  });
}
