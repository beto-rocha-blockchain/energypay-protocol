/**
 * Typed query-key factory for TanStack Query.
 * Use to coordinate cache invalidation across modules.
 */
export const qk = {
  settlements: {
    all: ["settlements"] as const,
    list: (filter?: unknown) => ["settlements", "list", filter ?? null] as const,
    detail: (id: string) => ["settlements", "detail", id] as const,
  },
  clearing: {
    all: ["clearing"] as const,
    list: (filter?: unknown) => ["clearing", "list", filter ?? null] as const,
    detail: (id: string) => ["clearing", "detail", id] as const,
  },
  reconciliation: {
    all: ["reconciliation"] as const,
    list: (filter?: unknown) => ["reconciliation", "list", filter ?? null] as const,
  },
  oracle: {
    all: ["oracle"] as const,
    feeds: () => ["oracle", "feeds"] as const,
    series: (sm: string, hours: number) => ["oracle", "series", sm, hours] as const,
  },
  risk: {
    all: ["risk"] as const,
    exposures: () => ["risk", "exposures"] as const,
  },
  treasury: {
    all: ["treasury"] as const,
    balances: () => ["treasury", "balances"] as const,
  },
  audit: {
    all: ["audit"] as const,
    list: (filter?: unknown) => ["audit", "list", filter ?? null] as const,
  },
  topology: {
    all: ["topology"] as const,
    snapshot: () => ["topology", "snapshot"] as const,
  },
  wallet: {
    balances: (publicKey: string) => ["wallet", "balances", publicKey] as const,
    activity: (publicKey: string) => ["wallet", "activity", publicKey] as const,
  },
  rail: {
    telemetry: () => ["rail", "telemetry"] as const,
    health: () => ["rail", "health"] as const,
  },
} as const;
