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
const TVL_ENDPOINT = 'https://testnet.neverland.money/api/neverland/tvl';

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

type CombinedStats = UserbaseResult & Partial<TvlData>;

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

  const fetchData = async (forceRefresh = false) => {
    // Check cache
    const now = Date.now();
    if (!forceRefresh && data && now - lastFetchTime.current < CACHE_DURATION) {
      console.log('Using cached userbase data');
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching userbase and TVL stats from API...');
      setLoading(true);
      const [userbase, tvlData] = await Promise.all([
        extractTotalUserbase({ endpoint: GOLDSKY_ENDPOINT }),
        fetchTvlData(),
      ]);

      console.log('Userbase data fetched successfully:', {
        totalUsers: userbase.totalUsers,
        totalTransactions: userbase.totalTransactions,
      });
      console.log('TVL data fetched successfully:', {
        tvl: tvlData.tvl,
        totalBorrowed: tvlData.totalBorrowed,
        activeReserves: tvlData.activeReserves,
      });

      setData({ ...userbase, ...tvlData });
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
