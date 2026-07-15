import type { ExperienceEntry } from '@/types/resume'

export function ExperienceList({ experience }: { experience: ExperienceEntry[] }) {
  return (
    <>
      {experience.map((entry) => (
        <div key={entry.id} className="mb-8 border-l-2 border-edge-2 pl-4">
          <h4 className="text-md font-medium text-white">
            {entry.role} <span className="text-faint">@ {entry.company}</span>
          </h4>
          <p className="text-xs text-muted mb-3">{entry.duration}</p>
          <ul className="space-y-2">
            {entry.bullets.map((bullet, i) => (
              <li key={i} className="text-sm text-ink-3 flex gap-2">
                <span className="text-ghost" aria-hidden>
                  -
                </span>
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}
