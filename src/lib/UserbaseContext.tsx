'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  useRef,
} from 'react';

const GOLDSKY_ENDPOINT =
  process.env.SUBGRAPH_URL ||
  'https://api.goldsky.com/api/public/project_cmeewhugja1gz01ukey477115/subgraphs/neverland-testnet/1.0.1/gn';
const TVL_ENDPOINT =
  process.env.TVL_ENDPOINT ||
  'https://testnet.neverland.money/api/neverland/tvl';

// Cache for 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

interface TvlData {
  tvl: string;
  tvlRaw: number;
  totalBorrowed: string;
  totalBorrowedRaw: number;
  activeReserves: number;
  totalReserves: number;
  timestamp: string;
  chainId: number;
  market: string;
}

interface ProtocolStats {
  totalRevenueUsd: string;
  totalTransactions: number;
  uniqueUsers: number;
}

type CombinedStats = Partial<TvlData> & Partial<ProtocolStats>;

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

  const fetchTvlData = async (): Promise<TvlData> => {
    const response = await fetch(TVL_ENDPOINT);

    if (!response.ok) {
      throw new Error(`Failed to fetch TVL data: ${response.statusText}`);
    }

    const result: TvlData = await response.json();
    return result;
  };

  const fetchProtocolStats = async (): Promise<ProtocolStats> => {
    const res = await fetch(GOLDSKY_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `query ProtocolOverview {\n  protocolStats(id: "1") {\n    totalRevenueUsd\n    totalTransactions\n    uniqueUsers\n  }\n}`,
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
      totalRevenueUsd: String(stats?.totalRevenueUsd ?? '0'),
      totalTransactions: parseInt(stats?.totalTransactions ?? '0'),
      uniqueUsers: parseInt(stats?.uniqueUsers ?? '0'),
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
      console.log('Fetching TVL and protocol stats from API...');
      setLoading(true);
      const [tvlData, protocolStats] = await Promise.all([
        fetchTvlData(),
        fetchProtocolStats(),
      ]);

      console.log('TVL data fetched successfully:', {
        tvl: tvlData.tvl,
        totalBorrowed: tvlData.totalBorrowed,
        activeReserves: tvlData.activeReserves,
      });
      console.log('Protocol stats fetched successfully:', {
        totalRevenueUsd: protocolStats.totalRevenueUsd,
        totalTransactions: protocolStats.totalTransactions,
        uniqueUsers: protocolStats.uniqueUsers,
      });

      setData({ ...tvlData, ...protocolStats });
      setError(null);
      lastFetchTime.current = now;
      // Only stop loading on success
      setLoading(false);
    } catch (err) {
      console.error('Error fetching stats:', err);
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
