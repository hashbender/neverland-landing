interface FetchOptions {
  endpoint: string;
}

interface UserbaseResult {
  totalUsers: number;
  totalTransactions: number;
  transactionsPerMonth: number;
}

/**
 * Fetch userbase stats from subgraph aggregates
 * @param options - Fetch options with endpoint
 * @returns UserbaseResult with total users, transactions, and monthly transactions
 */
export async function extractTotalUserbase(
  options: FetchOptions,
): Promise<UserbaseResult> {
  const { endpoint } = options;

  console.log('Fetching global stats...');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `{
        globalStats(id: "global") {
          totalUsers
          totalTransactions
        }
        monthlySnapshots(first: 1, orderDirection: desc) {
          transactionCount
        }
      }`,
    }),
  });

  if (!res.ok) {
    throw new Error(`GraphQL error ${res.status}`);
  }

  const data = await res.json();
  if (data.errors) {
    throw new Error(JSON.stringify(data.errors));
  }

  const stats = data.data.globalStats;
  const monthlySnapshot = data.data.monthlySnapshots[0];

  const monthlyTxCount = monthlySnapshot
    ? parseInt(monthlySnapshot.transactionCount)
    : 0;

  console.log('Stats fetched:', {
    totalUsers: stats.totalUsers,
    totalTransactions: stats.totalTransactions,
    monthlyTx: monthlyTxCount,
  });

  return {
    totalUsers: parseInt(stats.totalUsers),
    totalTransactions: parseInt(stats.totalTransactions),
    transactionsPerMonth: monthlyTxCount,
  };
}

export type { FetchOptions, UserbaseResult };
