import { useState } from 'react'
import { FileInput } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import type { AiRunConfig } from '@/services/ai/types'
import { ingestReport, formatIngestSummary, hasSkips, type IngestSummary } from '../ingestReport'
import { ConnectProviderCard } from './ConnectProviderCard'

/**
 * The zero-cost daily driver: run Deep Research in the Gemini app (its
 * Scheduled Actions can run daily), paste the report here each morning.
 */
export function PasteImportPanel({ config }: { config: AiRunConfig | null }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<IngestSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!config) {
    return (
      <ConnectProviderCard description="Extraction turns a pasted research report into structured job candidates. It runs on whichever AI provider you configure — including a fully local model." />
    )
  }

  const run = async () => {
    setBusy(true)
    setError(null)
    setSummary(null)
    try {
      const result = await ingestReport(text, 'paste', config)
      setSummary(result)
      if (result.added > 0) setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <p className="text-sm text-muted mb-4 leading-relaxed">
        Paste a job-research report — e.g. a <strong className="text-ink-2">Gemini Deep Research</strong> run
        from the Gemini app (tip: schedule it there to run daily, free with your subscription). Jobs are
        extracted, deduped against your board, scored against your Master Resume, and queued below for review.
      </p>

      <Textarea
        rows={10}
        value={text}
        placeholder="Paste the full research report here…"
        onChange={(event) => setText(event.target.value)}
        aria-label="Research report"
      />

      <div className="flex items-center gap-4 mt-4 flex-wrap">
        <Button onClick={run} disabled={busy || !text.trim()}>
          <FileInput size={14} aria-hidden />
          {busy ? 'Extracting…' : 'Extract jobs'}
        </Button>
        {summary && (
          <span className="text-sm text-emerald-400">
            {summary.added === 0 && !hasSkips(summary)
              ? 'No jobs found in this report.'
              : formatIngestSummary(summary)}
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
