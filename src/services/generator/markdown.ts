import type { TailoredResume } from '@/types/generator'

/**
 * Text exporters. Markdown for humans and tools; plain text for pasting into
 * ATS web forms (which routinely mangle rich formatting). Only included
 * content is exported — what you see in the preview is exactly what ships.
 */

function bulletLine(text: string, metric: string | undefined, prefix: string): string {
  return `${prefix} ${text}${metric ? ` (${metric})` : ''}`
}

export function toMarkdown(tailored: TailoredResume): string {
  const { header } = tailored
  const lines: string[] = []

  lines.push(`# ${header.name}`)
  lines.push(`**${header.role}** · ${header.location}`)
  const contact = [
    header.email,
    header.phone,
    ...header.links.map((link) => `[${link.label}](${link.url})`),
  ].filter(Boolean)
  if (contact.length) lines.push(contact.join(' · '))

  if (tailored.summary.trim()) {
    lines.push('', '## Summary', tailored.summary.trim())
  }

  if (tailored.skillGroups.length) {
    lines.push('', '## Skills')
    for (const group of tailored.skillGroups) {
      lines.push(`- **${group.category}:** ${group.skills.map((skill) => skill.canonical).join(', ')}`)
    }
  }

  const experiences = tailored.experience.filter((entry) => entry.bullets.some((bullet) => bullet.included))
  if (experiences.length) {
    lines.push('', '## Experience')
    for (const entry of experiences) {
      lines.push('', `### ${entry.role} — ${entry.company}`)
      lines.push(`*${[entry.duration, entry.location].filter(Boolean).join(' · ')}*`)
      for (const bullet of entry.bullets.filter((b) => b.included)) {
        lines.push(bulletLine(bullet.text, bullet.metric, '-'))
      }
    }
  }

  const projects = tailored.projects.filter((project) => project.included)
  if (projects.length) {
    lines.push('', '## Projects')
    for (const project of projects) {
      const title = project.url ? `[${project.name}](${project.url})` : project.name
      lines.push('', `### ${title}`)
      if (project.tech.length) lines.push(`*${project.tech.join(', ')}*`)
      if (project.description.trim()) lines.push(project.description.trim())
      for (const bullet of project.bullets.filter((b) => b.included)) {
        lines.push(bulletLine(bullet.text, bullet.metric, '-'))
      }
    }
  }

  if (tailored.education.length) {
    lines.push('', '## Education')
    for (const entry of tailored.education) {
      lines.push(`- ${entry.degree} in ${entry.field}, ${entry.institution}${entry.period ? ` (${entry.period})` : ''}`)
    }
  }

  if (tailored.certifications.length) {
    lines.push('', '## Certifications')
    for (const cert of tailored.certifications) {
      lines.push(`- ${cert.name} — ${cert.issuer}`)
    }
  }

  if (tailored.languages.length) {
    lines.push('', '## Languages')
    lines.push(tailored.languages.map((language) => `${language.name} (${language.level})`).join(' · '))
  }

  return lines.join('\n')
}

/** Markdown stripped to ATS-form-safe plain text. */
export function toPlainText(tailored: TailoredResume): string {
  return toMarkdown(tailored)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 — $2') // links → label — url
    .replace(/^#{1,3} /gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
}
