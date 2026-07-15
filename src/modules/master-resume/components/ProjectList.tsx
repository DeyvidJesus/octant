import { Badge } from '@/components/ui/Badge'
import type { ProjectEntry } from '@/types/resume'

export function ProjectList({ projects }: { projects: ProjectEntry[] }) {
  return (
    <>
      {projects.map((project) => (
        <div key={project.id} className="border-l-2 border-indigo-900 pl-4 mb-4">
          <h4 className="text-md font-medium text-white">{project.name}</h4>
          <p className="text-xs text-muted mb-2">{project.description}</p>
          <div className="flex flex-wrap gap-1 mb-3">
            {project.tech.map((tech) => (
              <Badge key={tech} tone="indigo" className="text-[10px] px-1.5 py-0.5">
                {tech}
              </Badge>
            ))}
          </div>
          <ul className="space-y-1">
            {project.bullets.map((bullet, i) => (
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
