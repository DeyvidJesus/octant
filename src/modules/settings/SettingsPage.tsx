import { useRef, useState } from 'react'
import { Download, Upload, RotateCcw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { dexieStore } from '@/services/storage/dexieStore'
import { exportBackup, importBackup, clearAllData } from '@/services/storage/backup'

export function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setError(null)
    const backup = await exportBackup(dexieStore)
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `career-os-backup-${backup.exportedAt.slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setMessage('Backup downloaded.')
  }

  const handleImportFile = async (file: File) => {
    setError(null)
    setMessage(null)
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!window.confirm('Importing a backup replaces all current data. Continue?')) return
      await importBackup(dexieStore, parsed)
      // Reload so every store rehydrates from the imported data.
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the backup file.')
    }
  }

  const handleReset = async () => {
    if (!window.confirm('Reset ALL data to the initial seed? This cannot be undone (export a backup first).')) {
      return
    }
    await clearAllData(dexieStore)
    window.location.reload()
  }

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      <PageHeader
        title="Settings"
        subtitle="CareerOS is local-first: everything lives in this browser's IndexedDB. Backups are your responsibility — export regularly."
      />

      <div className="space-y-6">
        <Card>
          <h3 className="text-lg font-medium text-white mb-2">Backup & Restore</h3>
          <p className="text-sm text-muted mb-6">
            Export downloads a single JSON file with all your data. Import restores from a previous
            export, replacing what's currently stored.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button onClick={handleExport}>
              <Download size={16} aria-hidden /> Export Backup
            </Button>
            <Button variant="subtle" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} aria-hidden /> Import Backup
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleImportFile(file)
                event.target.value = ''
              }}
            />
          </div>
          {message && <p className="text-sm text-emerald-400 mt-4">{message}</p>}
          {error && (
            <p className="text-sm text-red-400 mt-4" role="alert">
              {error}
            </p>
          )}
        </Card>

        <Card className="border-red-900/30">
          <h3 className="text-lg font-medium text-white mb-2">Danger Zone</h3>
          <p className="text-sm text-muted mb-6">
            Wipes everything and restores the initial seed data on next load.
          </p>
          <Button variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-900/10" onClick={handleReset}>
            <RotateCcw size={16} aria-hidden /> Reset to Seed Data
          </Button>
        </Card>
      </div>
    </div>
  )
}
