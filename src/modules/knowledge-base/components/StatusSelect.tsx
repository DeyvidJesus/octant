import type { FactStatus } from '@/types/resume'
import { Select } from '@/components/ui/Select'
import { FACT_STATUSES, FACT_STATUS_LABELS } from '@/constants/knowledge'

export function StatusSelect({ value, onChange }: { value: FactStatus; onChange: (status: FactStatus) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as FactStatus)}>
      {FACT_STATUSES.map((status) => (
        <option key={status} value={status}>
          {FACT_STATUS_LABELS[status]}
        </option>
      ))}
    </Select>
  )
}
