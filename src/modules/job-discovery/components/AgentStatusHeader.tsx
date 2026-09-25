import { useState } from 'react'
import { Radar, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useDiscoveryStore } from '@/stores/discoveryStore'
import { runInSessionDiscovery } from '@/stores/discoveryRunner'
import { buildDigest } from '@/services/discovery/proactivity'
import { formatRelative } from '@/utils/dates'

/**
 * The "agent working for your career" surface: live status of the discovery pipeline (idle /
 * searching / scoring / done / error), driven by the store's realtime run state + in-flight
 * progress, plus a manual "Run now". The candidate feed below is already ranked by score.
 */
export function AgentStatusHeader() {
  const currentRun = useDiscoveryStore((s) => s.currentRun)
  const progress = useDiscoveryStore((s) => s.progress)
  const pendingCount = useDiscoveryStore((s) => s.candidates.length)
  const candidates = useDiscoveryStore((s) => s.candidates)
  const lastSeenAt = useDiscoveryStore((s) => s.lastSeenAt)
  const [starting, setStarting] = useState(false)

  const running = progress !== null || currentRun?.status === 'running'
  const digest = running ? null : buildDigest(candidates, lastSeenAt)

  const statusLine = (() => {
    if (progress?.phase === 'searching') return `Searching${progress.strategyLabel ? `: ${progress.strategyLabel}` : '…'}`
    if (progress?.phase === 'scoring') return `Scoring opportunities… (${progress.fresh} found)`
    if (running) return 'Working…'
    if (currentRun?.status === 'failed') return 'Last run hit an error — try again.'
    if (currentRun?.finishedAt) {
      const fresh = currentRun.stats.fresh ?? 0
      return `Last run ${formatRelative(currentRun.finishedAt)} — ${fresh} new ${fresh === 1 ? 'opportunity' : 'opportunities'}.`
    }
    return 'Your discovery agent is ready. It ranks new opportunities against your profile.'
  })()

  const handleRun = async () => {
    setStarting(true)
    try {
      await runInSessionDiscovery('manual')
    } finally {
      setStarting(false)
    }
  }

  const Icon = currentRun?.status === 'failed' && !running ? AlertCircle : running ? Loader2 : Radar

  return (
    <Card className="flex items-center gap-4 border-edge-2">
      <div className={`rounded-xl p-3 ${running ? 'bg-info/10' : 'bg-surface-2'}`}>
        <Icon
          size={22}
          className={`${running ? 'animate-spin text-info' : currentRun?.status === 'failed' ? 'text-danger' : 'text-ink-2'}`}
          aria-hidden
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-ink-strong font-medium">Discovery agent</h2>
          <span className="text-xs text-faint">· {pendingCount} in review</span>
        </div>
        <p className="text-sm text-muted truncate" aria-live="polite">
          {statusLine}
        </p>
        {digest && <p className="text-sm text-success truncate mt-0.5">{digest}</p>}
      </div>
      <Button onClick={handleRun} disabled={running || starting}>
        {running ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Sparkles size={14} aria-hidden />}
        {running ? 'Working…' : 'Run now'}
      </Button>
    </Card>
  )
}
