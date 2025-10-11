'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  useRef,
} from 'react';

import { extractTotalUserbase, type UserbaseResult } from './userbase';

const GOLDSKY_ENDPOINT =
  'https://api.goldsky.com/api/public/project_cmeewhugja1gz01ukey477115/subgraphs/testnet-snapshot/1.1.2/gn';
const GOLDSKY_ENDPOINT_PROTOCOL_STATS =
  'https://api.goldsky.com/api/public/project_cmeewhugja1gz01ukey477115/subgraphs/neverland-leaderboard/1.0.6/gn';

// Cache for 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

type ProtocolStats = {
  tvlUsd: string;
  totalRevenueUsd: string;
};

type CombinedStats = UserbaseResult & Partial<ProtocolStats>;

interface UserbaseContextType {
  data: CombinedStats | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const UserbaseContext = createContext<UserbaseContextType | undefined>(
  undefined,
);

export function UserbaseProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CombinedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const lastFetchTime = useRef<number>(0);

  const fetchProtocolStats = async (): Promise<ProtocolStats> => {
    const res = await fetch(GOLDSKY_ENDPOINT_PROTOCOL_STATS, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `query ProtocolOverview {\n  protocolStats(id: "1") {\n    tvlUsd\n    totalRevenueUsd\n    updatedAt\n  }\n}`,
      }),
    });

    if (!res.ok) {
      throw new Error(`Protocol stats GraphQL error ${res.status}`);
    }

    const json = await res.json();
    if (json.errors) {
      throw new Error(JSON.stringify(json.errors));
    }

    const stats = json.data?.protocolStats;
    return {
      tvlUsd: String(stats?.tvlUsd ?? '0'),
      totalRevenueUsd: String(stats?.totalRevenueUsd ?? '0'),
    };
  };

  const fetchData = async (forceRefresh = false) => {
    // Check cache
    const now = Date.now();
    if (!forceRefresh && data && now - lastFetchTime.current < CACHE_DURATION) {
      console.log('Using cached userbase data');
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching userbase and protocol stats from API...');
      setLoading(true);
      const [userbase, protocol] = await Promise.all([
        extractTotalUserbase({ endpoint: GOLDSKY_ENDPOINT }),
        fetchProtocolStats(),
      ]);

      console.log('Userbase data fetched successfully:', {
        totalUsers: userbase.totalUsers,
        totalTransactions: userbase.totalTransactions,
      });
      console.log('Protocol stats fetched successfully:', {
        tvlUsd: protocol.tvlUsd,
        totalRevenueUsd: protocol.totalRevenueUsd,
      });

      setData({ ...userbase, ...protocol });
      setError(null);
      lastFetchTime.current = now;
      // Only stop loading on success
      setLoading(false);
    } catch (err) {
      console.error('Error fetching userbase:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // Keep loading=true on error to maintain blur effect
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <UserbaseContext.Provider
      value={{ data, loading, error, refetch: () => fetchData(true) }}
    >
      {children}
    </UserbaseContext.Provider>
  );
}

export function useUserbaseContext() {
  const context = useContext(UserbaseContext);
  if (context === undefined) {
    throw new Error(
      'useUserbaseContext must be used within a UserbaseProvider',
    );
  }
  return context;
}

/**
 * Format a number with thousand separators
 * @param num - Number to format
 * @returns Formatted string (e.g., "1,234,567")
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}
