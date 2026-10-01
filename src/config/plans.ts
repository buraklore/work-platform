/**
 * Plan limits — the single source of truth. Enforced on the server (service layer +
 * SQL functions that receive these numbers); the UI reads the same values.
 * `null` means unlimited.
 */
export type PlanId = "free" | "pro" | "team" | "business";

export type PlanLimits = {
  /** Free workspaces a user may own (membership in others is unlimited). */
  ownedWorkspaces: number | null;
  /** owner + admin + member */
  members: number | null;
  /** guests do not count towards `members` */
  guests: number | null;
  /** non-personal, non-archived projects */
  projects: number | null;
  /** tasks that are neither deleted nor in a "done" status */
  activeTasks: number | null;
  storageBytes: number | null;
  fileBytes: number | null;
};

const MB = 1024 * 1024;

export const PLANS: Record<PlanId, { id: PlanId; limits: PlanLimits; available: boolean }> = {
  free: {
    id: "free",
    available: true,
    limits: {
      ownedWorkspaces: 1,
      members: 5,
      guests: 10,
      projects: 10,
      activeTasks: 500,
      storageBytes: 500 * MB,
      fileBytes: 10 * MB,
    },
  },
  // Paid plans go on sale with billing (M3). Until then `available: false` keeps them
  // out of every UI; their limits already drive the entitlement layer and its tests.
  pro: {
    id: "pro",
    available: false,
    limits: { ownedWorkspaces: null, members: 10, guests: 20, projects: null, activeTasks: null, storageBytes: 10_240 * MB, fileBytes: 100 * MB },
  },
  team: {
    id: "team",
    available: false,
    limits: { ownedWorkspaces: null, members: 50, guests: 100, projects: null, activeTasks: null, storageBytes: 102_400 * MB, fileBytes: 250 * MB },
  },
  business: {
    id: "business",
    available: false,
    limits: { ownedWorkspaces: null, members: null, guests: null, projects: null, activeTasks: null, storageBytes: null, fileBytes: 500 * MB },
  },
};

export function limitsFor(plan: string): PlanLimits {
  return (PLANS[plan as PlanId] ?? PLANS.free).limits;
}

/** Shape passed to SQL functions that enforce limits inside their own transaction. */
export function limitsJson(): Record<string, Partial<Record<keyof PlanLimits, number>>> {
  const out: Record<string, Partial<Record<keyof PlanLimits, number>>> = {};
  for (const plan of Object.values(PLANS)) {
    const entry: Partial<Record<keyof PlanLimits, number>> = {};
    for (const [key, value] of Object.entries(plan.limits)) {
      if (value !== null) entry[key as keyof PlanLimits] = value;
    }
    out[plan.id] = entry;
  }
  return out;
}
