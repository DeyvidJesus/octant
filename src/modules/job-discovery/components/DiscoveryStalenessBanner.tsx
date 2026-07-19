import { Link } from 'react-router-dom'
import { Radar } from 'lucide-react'
import { useSettingsStore, resolveAiRunConfig } from '@/stores/settingsStore'
import { useDiscoveryStore } from '@/stores/discoveryStore'
import { providerSupportsWebSearch } from '@/services/ai/registry'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The "every day" mechanism, local-first style: a browser app can't run while
 * closed, so freshness is a derived nudge, never an automatic spend. Renders
 * nothing unless the user opted in AND a capable provider is ready AND the
 * last sweep is stale. Pure derivation — no effects.
 */
export function DiscoveryStalenessBanner() {
  const staleReminder = useSettingsStore((state) => state.discovery.staleReminder)
  const lastSweepAt = useDiscoveryStore((state) => state.lastSweepAt)

  if (!staleReminder) return null
  const config = resolveAiRunConfig()
  if (!config || !providerSupportsWebSearch(config.providerId)) return null

  const stale = lastSweepAt === null || Date.now() - new Date(lastSweepAt).getTime() > DAY_MS
  if (!stale) return null

  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-indigo-800/50 bg-indigo-900/20 px-4 py-3">
      <Radar size={16} className="text-indigo-300 shrink-0" aria-hidden />
      <p className="text-sm text-indigo-200 flex-1">
        {lastSweepAt === null
          ? 'You have never run a job sweep.'
          : 'Your last job sweep was more than a day ago.'}{' '}
        Fresh postings get the best response rates.
      </p>
      <Link
        to="/jobs/discovery"
        className="text-sm text-indigo-300 hover:text-white font-medium whitespace-nowrap"
      >
        Run sweep →
      </Link>
    </div>
  )
}
