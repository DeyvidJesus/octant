import { Check } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { useResumeStore } from '@/stores/resumeStore'
import { formatDate } from '@/utils/dates'
import { ProfileCard } from './components/ProfileCard'
import { ExperienceList } from './components/ExperienceList'
import { ProjectList } from './components/ProjectList'
import { SkillsGrid } from './components/SkillsGrid'
import { StoriesEditor } from './components/StoriesEditor'
import { CertificationsEditor, EducationEditor, LanguagesEditor } from './components/CredentialsEditor'
import { PublicationsEditor, LearningEditor, PortfolioEditor } from './components/GrowthEditor'
import { CollapsibleSection } from './components/CollapsibleSection'

export function MasterResumePage() {
  const resume = useResumeStore((state) => state.resume)
  const updateResume = useResumeStore((state) => state.updateResume)

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in pb-24">
      <PageHeader
        title="Master Resume"
        subtitle="The single source of truth. Everything is stored once here; tailored resumes and analyses select from it. Changes save automatically."
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Check size={14} className="text-emerald-400" aria-hidden />
            Saved · {formatDate(resume.updatedAt)}
          </span>
        }
      />

      <div className="space-y-4">
        <CollapsibleSection title="Profile" defaultOpen>
          <ProfileCard resume={resume} onChange={updateResume} />
        </CollapsibleSection>

        <CollapsibleSection title="Experience" count={resume.experience.length} defaultOpen>
          <ExperienceList experience={resume.experience} onChange={(experience) => updateResume({ experience })} />
        </CollapsibleSection>

        <CollapsibleSection title="Projects" count={resume.projects.length} defaultOpen>
          <ProjectList projects={resume.projects} onChange={(projects) => updateResume({ projects })} />
        </CollapsibleSection>

        <CollapsibleSection title="Skills" count={resume.skills.length} defaultOpen>
          <SkillsGrid skills={resume.skills} onChange={(skills) => updateResume({ skills })} />
        </CollapsibleSection>

        <CollapsibleSection title="STAR Stories" count={resume.stories.length}>
          <StoriesEditor
            stories={resume.stories}
            experiences={resume.experience}
            onChange={(stories) => updateResume({ stories })}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Certifications" count={resume.certifications.length}>
          <CertificationsEditor
            certifications={resume.certifications}
            onChange={(certifications) => updateResume({ certifications })}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Education" count={resume.education.length}>
          <EducationEditor education={resume.education} onChange={(education) => updateResume({ education })} />
        </CollapsibleSection>

        <CollapsibleSection title="Publications" count={resume.publications.length}>
          <PublicationsEditor
            publications={resume.publications}
            onChange={(publications) => updateResume({ publications })}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Learning History" count={resume.learning.length}>
          <LearningEditor learning={resume.learning} onChange={(learning) => updateResume({ learning })} />
        </CollapsibleSection>

        <CollapsibleSection title="Portfolio" count={resume.portfolio.length}>
          <PortfolioEditor portfolio={resume.portfolio} onChange={(portfolio) => updateResume({ portfolio })} />
        </CollapsibleSection>

        <CollapsibleSection title="Languages" count={resume.languages.length}>
          <LanguagesEditor languages={resume.languages} onChange={(languages) => updateResume({ languages })} />
        </CollapsibleSection>
      </div>
    </div>
  )
}
