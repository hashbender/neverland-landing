'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  useRef,
} from 'react';

const TVL_ENDPOINT = 'https://testnet.neverland.money/api/neverland/tvl';

// Cache for 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

export interface TvlData {
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

interface TvlContextType {
  data: TvlData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const TvlContext = createContext<TvlContextType | undefined>(undefined);

export function TvlProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TvlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const lastFetchTime = useRef<number>(0);

  const fetchData = async (forceRefresh = false) => {
    // Check cache
    const now = Date.now();
    if (!forceRefresh && data && now - lastFetchTime.current < CACHE_DURATION) {
      console.log('Using cached TVL data');
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching TVL data from API...');
      setLoading(true);
      const response = await fetch(TVL_ENDPOINT);

      if (!response.ok) {
        throw new Error(`Failed to fetch TVL data: ${response.statusText}`);
      }

      const result: TvlData = await response.json();
      console.log('TVL data fetched successfully:', {
        tvl: result.tvl,
        totalBorrowed: result.totalBorrowed,
        activeReserves: result.activeReserves,
      });
      setData(result);
      setError(null);
      lastFetchTime.current = now;
      setLoading(false);
    } catch (err) {
      console.error('Error fetching TVL:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // Keep loading=true on error to maintain blur effect
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TvlContext.Provider
      value={{ data, loading, error, refetch: () => fetchData(true) }}
    >
      {children}
    </TvlContext.Provider>
  );
}

export function useTvlContext() {
  const context = useContext(TvlContext);
  if (context === undefined) {
    throw new Error('useTvlContext must be used within a TvlProvider');
  }
  return context;
}

/**
 * Format TVL value for display
 * @param tvl - TVL value as string (e.g., "425845.34")
 * @returns Formatted string (e.g., "425.85K" or "1.23M")
 */
export function formatTvl(tvl: string | number): string {
  const value = typeof tvl === 'string' ? parseFloat(tvl) : tvl;

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }

  return value.toFixed(2);
}
