import type { PlanTier } from '@/constants/plan'

/** Background discovery interval per plan tier, shared by the worker and the UI. */
export const DISCOVERY_CADENCE_HOURS: Record<PlanTier, number> = {
  free: 24,
  pro: 1,
}

/** True when a user is due for a scheduled run: never run, or last finished older than their cadence. */
export function isDueForRun(lastFinishedAt: string | null, tier: PlanTier, nowMs: number): boolean {
  if (!lastFinishedAt) return true
  const last = Date.parse(lastFinishedAt)
  if (Number.isNaN(last)) return true
  return nowMs - last >= DISCOVERY_CADENCE_HOURS[tier] * 3_600_000
}
