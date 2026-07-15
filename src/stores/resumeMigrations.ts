import type { MasterResume, Skill } from '@/types/resume'
import { createSeedResume } from '@/constants/seedData'
import { createId } from '@/utils/id'

/** The persisted slice of the resume store. */
export interface PersistedResume {
  resume: MasterResume
}

/**
 * Migrates persisted resume state across schema versions. v1 was the flat
 * prototype shape (string bullets, `skills` as {label, skills[]} groups,
 * `personal.english`); v2 is the rich entity model. Kept pure and tested so
 * years-old backups remain restorable (§1.2 of the design review).
 */
export function migrateResumeState(persisted: unknown, fromVersion: number): PersistedResume {
  if (fromVersion >= 2) return persisted as PersistedResume

  const old = (persisted as { resume?: LegacyResume } | undefined)?.resume
  if (!old) return { resume: createSeedResume() }

  return { resume: migrateV1ToV2(old) }
}

interface LegacyResume {
  personal?: { name?: string; role?: string; location?: string; english?: string }
  summary?: string
  goals?: string
  values?: string[]
  experience?: Array<{ id?: string; company?: string; role?: string; duration?: string; bullets?: string[] }>
  projects?: Array<{ id?: string; name?: string; tech?: string[]; description?: string; bullets?: string[] }>
  skills?: Array<{ label?: string; skills?: string[] }>
  updatedAt?: string
}

function migrateV1ToV2(old: LegacyResume): MasterResume {
  const languages: MasterResume['languages'] = [{ id: createId(), name: 'Portuguese', level: 'Native' }]
  if (old.personal?.english) {
    languages.push({ id: createId(), name: 'English', level: old.personal.english })
  }

  const skills: Skill[] = (old.skills ?? []).flatMap((group) =>
    (group.skills ?? []).map((canonical) => ({
      id: createId(),
      canonical,
      category: group.label ?? 'Other',
    })),
  )

  return {
    personal: {
      name: old.personal?.name ?? '',
      role: old.personal?.role ?? '',
      location: old.personal?.location ?? '',
    },
    summary: old.summary ?? '',
    goals: old.goals ?? '',
    values: old.values ?? [],
    experience: (old.experience ?? []).map((entry) => ({
      id: entry.id ?? createId(),
      company: entry.company ?? '',
      role: entry.role ?? '',
      duration: entry.duration ?? '',
      accomplishments: (entry.bullets ?? []).map((text) => ({ id: createId(), text, skills: [], keywords: [] })),
    })),
    projects: (old.projects ?? []).map((project) => ({
      id: project.id ?? createId(),
      name: project.name ?? '',
      tech: project.tech ?? [],
      description: project.description ?? '',
      accomplishments: (project.bullets ?? []).map((text) => ({ id: createId(), text, skills: [], keywords: [] })),
    })),
    skills,
    stories: [],
    certifications: [],
    education: [],
    publications: [],
    learning: [],
    portfolio: [],
    languages,
    updatedAt: old.updatedAt ?? new Date().toISOString(),
  }
}
