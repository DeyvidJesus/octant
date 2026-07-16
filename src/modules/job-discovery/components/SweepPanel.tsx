import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Radar, Settings2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { AiRunConfig } from '@/services/ai/types'
import { providerSupportsWebSearch, getProviderDescriptor } from '@/services/ai/registry'
import { sweepJobs, buildResumeFacts } from '@/services/ai/tasks/discoverJobs'
import { useSettingsStore } from '@/stores/settingsStore'
import { useResumeStore } from '@/stores/resumeStore'
import { useDiscoveryStore } from '@/stores/discoveryStore'
import { ingestExtraction, formatIngestSummary, hasSkips, type IngestSummary } from '../ingestReport'
import { ConnectProviderCard } from './ConnectProviderCard'
import { formatDate } from '@/utils/dates'

/** The routine engine: a search-grounded completion — seconds, ~cents per run. */
export function SweepPanel({ config }: { config: AiRunConfig | null }) {
  const prefs = useSettingsStore((state) => state.discovery)
  const resume = useResumeStore((state) => state.resume)
  const lastSweepAt = useDiscoveryStore((state) => state.lastSweepAt)

  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<IngestSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!config) {
    return (
      <ConnectProviderCard description="The sweep asks a search-grounded AI for real, currently open postings matching your profile — it needs a configured provider." />
    )
  }

  const capable = providerSupportsWebSearch(config.providerId)
  const providerLabel = getProviderDescriptor(config.providerId)?.label ?? config.providerId

  const run = async () => {
    setBusy(true)
    setError(null)
    setSummary(null)
    try {
      const result = await sweepJobs({ prefs, resumeFacts: buildResumeFacts(resume) }, config)
      setSummary(await ingestExtraction(result.extraction, 'sweep'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sweep failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <p className="text-sm text-muted mb-4 leading-relaxed">
        Searches the web for currently open roles matching your Master Resume and discovery
        preferences. Fast and cheap (~cents per run) — the routine engine for daily freshness.
      </p>

      <div className="bg-base border border-edge rounded-lg p-4 mb-4 text-sm space-y-1">
        <PrefLine label="Target roles" value={prefs.targetRoles} />
        <PrefLine label="Regions" value={prefs.regions} />
        <PrefLine label="Seniority" value={prefs.seniority} />
        <div className="pt-2">
          <Link to="/settings" className="text-xs text-muted hover:text-ink-2 inline-flex items-center gap-1">
            <Settings2 size={12} aria-hidden /> Edit discovery preferences in Settings
          </Link>
        </div>
      </div>

      {!capable && (
        <p className="text-sm text-amber-400/90 mb-4">
          {providerLabel} can't search the web. Switch to a search-capable provider in Settings, or
          use the Paste tab instead.
        </p>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <Button onClick={run} disabled={busy || !capable}>
          <Radar size={14} aria-hidden />
          {busy ? 'Sweeping…' : 'Run sweep'}
        </Button>
        <span className="text-xs text-faint">
          {lastSweepAt ? `Last sweep: ${formatDate(lastSweepAt)}` : 'Never run'}
        </span>
        {summary && (
          <span className="text-sm text-emerald-400">
            {summary.added === 0 && !hasSkips(summary) ? 'No new jobs found.' : formatIngestSummary(summary)}
          </span>
        )}
      </div>

      {summary && summary.warnings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {summary.warnings.map((warning, i) => (
            <li key={i} className="text-xs text-amber-400/90">
              {warning}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-sm text-red-400 mt-4" role="alert">
          {error}
        </p>
      )}
    </Card>
  )
}

function PrefLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-faint w-24 shrink-0 text-xs uppercase tracking-wider pt-0.5">{label}</span>
      <span className="text-ink-2">{value || <span className="text-faint">derived from Master Resume</span>}</span>
    </div>
  )
}
