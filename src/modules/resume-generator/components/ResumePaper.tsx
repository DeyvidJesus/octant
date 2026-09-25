import type { TailoredBullet, TailoredResume } from '@/types/generator'

// Plain single-column layout so ATS parsers can read it; always light so preview matches print.
// Excluded items render dimmed on screen and are omitted from print.
interface ResumePaperProps {
  tailored: TailoredResume
  onToggleBullet: (accomplishmentId: string) => void
  onToggleProject: (projectId: string) => void
}

export function ResumePaper({ tailored, onToggleBullet, onToggleProject }: ResumePaperProps) {
  const { header } = tailored
  const contact = [header.location, header.email, header.phone].filter(Boolean).join(' · ')

  return (
    <div
      id="resume-paper"
      className="bg-paper text-neutral-900 rounded-lg shadow-2xl px-10 py-9 max-w-[52rem] text-[13.5px] leading-relaxed print:shadow-none print:rounded-none print:px-0 print:py-0 print:max-w-none"
    >
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">{header.name}</h1>
        <p className="text-[15px] font-medium text-neutral-700">{header.role}</p>
        <p className="text-neutral-600 mt-1">{contact}</p>
        {header.links.length > 0 && (
          <p className="text-neutral-600">
            {header.links.map((link, i) => (
              <span key={link.url}>
                {i > 0 && ' · '}
                <a href={link.url} className="underline decoration-neutral-300">
                  {link.url.replace(/^https?:\/\//, '')}
                </a>
              </span>
            ))}
          </p>
        )}
      </header>

      {tailored.summary.trim() && (
        <PaperSection title="Summary">
          <p>{tailored.summary}</p>
        </PaperSection>
      )}

      {tailored.skillGroups.length > 0 && (
        <PaperSection title="Skills">
          {tailored.skillGroups.map((group) => (
            <p key={group.category}>
              <span className="font-semibold">{group.category}: </span>
              {group.skills.map((skill, i) => (
                <span key={skill.canonical} className={skill.matched ? 'font-medium' : ''}>
                  {i > 0 && ', '}
                  {skill.canonical}
                </span>
              ))}
            </p>
          ))}
        </PaperSection>
      )}

      {tailored.experience.length > 0 && (
        <PaperSection title="Experience">
          {tailored.experience.map((entry) => (
            <div key={entry.experienceId} className="mb-4 last:mb-0">
              <div className="flex justify-between items-baseline gap-4">
                <p className="font-semibold">
                  {entry.role} <span className="font-normal text-neutral-600">— {entry.company}</span>
                </p>
                <p className="text-neutral-500 text-xs whitespace-nowrap">
                  {[entry.duration, entry.location].filter(Boolean).join(' · ')}
                </p>
              </div>
              <ul className="mt-1.5 space-y-1">
                {entry.bullets.map((bullet) => (
                  <BulletLine key={bullet.accomplishmentId} bullet={bullet} onToggle={onToggleBullet} />
                ))}
              </ul>
            </div>
          ))}
        </PaperSection>
      )}

      {tailored.projects.length > 0 && (
        <PaperSection title="Projects">
          {tailored.projects.map((project) => (
            <div
              key={project.projectId}
              className={`mb-3 last:mb-0 ${project.included ? '' : 'opacity-40 print:hidden'}`}
            >
              <div className="flex items-baseline gap-2">
                <input
                  type="checkbox"
                  checked={project.included}
                  onChange={() => onToggleProject(project.projectId)}
                  aria-label={`Include project ${project.name}`}
                  className="accent-neutral-800 print:hidden"
                />
                <p className="font-semibold">
                  {project.url ? (
                    <a href={project.url} className="underline decoration-neutral-300">
                      {project.name}
                    </a>
                  ) : (
                    project.name
                  )}
                  {project.tech.length > 0 && (
                    <span className="font-normal text-neutral-600"> — {project.tech.join(', ')}</span>
                  )}
                </p>
              </div>
              {project.description.trim() && <p className="ml-5 print:ml-0">{project.description}</p>}
              {project.included && project.bullets.length > 0 && (
                <ul className="mt-1 ml-5 print:ml-0 space-y-1">
                  {project.bullets.map((bullet) => (
                    <BulletLine key={bullet.accomplishmentId} bullet={bullet} onToggle={onToggleBullet} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </PaperSection>
      )}

      {tailored.education.length > 0 && (
        <PaperSection title="Education">
          {tailored.education.map((entry) => (
            <p key={entry.educationId}>
              <span className="font-semibold">
                {entry.degree} in {entry.field}
              </span>
              , {entry.institution}
              {entry.period && <span className="text-neutral-500"> ({entry.period})</span>}
            </p>
          ))}
        </PaperSection>
      )}

      {tailored.certifications.length > 0 && (
        <PaperSection title="Certifications">
          {tailored.certifications.map((cert) => (
            <p key={cert.certificationId}>
              {cert.name} — {cert.issuer}
            </p>
          ))}
        </PaperSection>
      )}

      {tailored.languages.length > 0 && (
        <PaperSection title="Languages">
          <p>{tailored.languages.map((language) => `${language.name} (${language.level})`).join(' · ')}</p>
        </PaperSection>
      )}
    </div>
  )
}

function PaperSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 last:mb-0">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-500 border-b border-neutral-200 pb-1 mb-2">
        {title}
      </h2>
      {children}
    </section>
  )
}

function BulletLine({ bullet, onToggle }: { bullet: TailoredBullet; onToggle: (id: string) => void }) {
  return (
    <li className={`flex items-start gap-2 ${bullet.included ? '' : 'opacity-40 line-through print:hidden'}`}>
      <input
        type="checkbox"
        checked={bullet.included}
        onChange={() => onToggle(bullet.accomplishmentId)}
        aria-label={`Include: ${bullet.text.slice(0, 60)}`}
        className="mt-1 accent-neutral-800 print:hidden"
      />
      <span>
        <span aria-hidden className="hidden print:inline">
          •{' '}
        </span>
        {bullet.text}
        {bullet.metric && <span className="text-neutral-600"> ({bullet.metric})</span>}
      </span>
    </li>
  )
}
