import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { useResumeStore } from '@/stores/resumeStore'
import { ProfileCard } from './components/ProfileCard'
import { ExperienceList } from './components/ExperienceList'
import { ProjectList } from './components/ProjectList'
import { SkillsGrid } from './components/SkillsGrid'

export function MasterResumePage() {
  const resume = useResumeStore((state) => state.resume)

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in pb-24">
      <PageHeader
        title="Master Resume"
        subtitle="The single source of truth. Every analysis and tailored document derives from this database — editing arrives in the next increment."
      />

      <div className="space-y-6">
        <ProfileCard resume={resume} />

        <Card>
          <h3 className="text-lg font-medium text-white mb-4">Experience & Project Repository</h3>
          <ExperienceList experience={resume.experience} />
          <div className="mt-8 pt-6 border-t border-edge">
            <SectionLabel className="mb-4">Key Projects</SectionLabel>
            <ProjectList projects={resume.projects} />
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-medium text-white mb-4">Technical Architecture & Taxonomy</h3>
          <SkillsGrid skills={resume.skills} />
        </Card>
      </div>
    </div>
  )
}
