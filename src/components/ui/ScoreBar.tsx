interface ScoreBarProps {
  label: string
  score: number
  max: number
}

export function ScoreBar({ label, score, max }: ScoreBarProps) {
  return (
    <div
      className="flex items-center justify-between"
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <span className="text-sm text-muted font-medium">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, i) => (
          <div key={i} className={`w-8 h-2 rounded-full ${i < score ? 'bg-white' : 'bg-edge'}`} />
        ))}
      </div>
    </div>
  )
}
