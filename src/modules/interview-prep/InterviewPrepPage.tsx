import { useMemo, useState } from 'react'
import { BookOpenCheck, BrainCircuit, CalendarDays, Code2, MessageSquareText, Target, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { useApplicationsStore } from '@/stores/applicationsStore'
import { useJobsStore } from '@/stores/jobsStore'
import { useResumeStore } from '@/stores/resumeStore'
import { INTERVIEW_STAGES } from '@/constants/applicationStages'

const DEFAULT_TECHNICAL_TOPICS = ['Data structures', 'API design', 'Testing strategy', 'Performance debugging']
const DEFAULT_SYSTEM_DESIGN = ['Clarify requirements', 'Define data model', 'Choose boundaries', 'Name tradeoffs']
const MOCK_PROMPTS = [
  'Walk me through a project where you owned the technical direction.',
  'Tell me about a production issue you debugged and what changed afterward.',
  'How would you explain a complex engineering tradeoff to a non-technical stakeholder?',
]

function scoreTone(score?: number) {
  if (score === undefined) return 'default'
  if (score >= 75) return 'emerald'
  if (score >= 50) return 'indigo'
  return 'red'
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

export function InterviewPrepPage() {
  const resume = useResumeStore((state) => state.resume)
  const jobs = useJobsStore((state) => state.jobs)
  const analyses = useJobsStore((state) => state.analyses)
  const applications = useApplicationsStore((state) => state.applications)
  const [selectedJobId, setSelectedJobId] = useState(() => {
    const activeApplication = applications.find((application) => application.jobId && INTERVIEW_STAGES.includes(application.stage))
    return activeApplication?.jobId ?? jobs.find((job) => !job.archived)?.id ?? jobs[0]?.id ?? ''
  })

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs.find((job) => !job.archived) ?? jobs[0]
  const selectedAnalysis = selectedJob ? analyses[selectedJob.id] : undefined
  const selectedApplication = selectedJob
    ? applications.find((application) => application.jobId === selectedJob.id)
    : applications.find((application) => INTERVIEW_STAGES.includes(application.stage))

  const interviewApplications = applications.filter((application) => INTERVIEW_STAGES.includes(application.stage))
  const analyzedJobs = jobs.filter((job) => analyses[job.id])
  const resumeSkills = resume.skills.map((skill) => skill.canonical)
  const favoriteSkills = resume.skills.filter((skill) => skill.favorite).map((skill) => skill.canonical).slice(0, 6)

  const technicalTopics = useMemo(() => {
    const detected = selectedAnalysis?.detectedStack.map((skill) => skill.canonical) ?? []
    return unique([...detected, ...favoriteSkills, ...DEFAULT_TECHNICAL_TOPICS]).slice(0, 10)
  }, [favoriteSkills, selectedAnalysis])

  const weaknesses = useMemo(() => {
    const missing = selectedAnalysis?.match.missing ?? []
    const lowerResumeSkills = new Set(resumeSkills.map((skill) => skill.toLowerCase()))
    const jobTags = selectedJob?.tags.filter((tag) => !lowerResumeSkills.has(tag.toLowerCase())) ?? []
    return unique([...missing, ...jobTags]).slice(0, 6)
  }, [resumeSkills, selectedAnalysis, selectedJob])

  const storyBank = resume.stories.slice(0, 4)
  const architectureSeeds = unique([
    ...(selectedAnalysis?.match.categoryBreakdown.flatMap((category) => category.matched) ?? []),
    ...resume.projects.flatMap((project) => project.tech),
    ...DEFAULT_SYSTEM_DESIGN,
  ]).slice(0, 8)

  const readinessScore = Math.round(
    (selectedAnalysis?.match.atsScore ?? 45) * 0.45
    + Math.min(storyBank.length, 4) * 10
    + Math.min(technicalTopics.length, 8) * 2
    + (selectedApplication && INTERVIEW_STAGES.includes(selectedApplication.stage) ? 8 : 0),
  )

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <PageHeader
        title="Interview Prep"
        subtitle="Local-first prep dossiers assembled from your Master Resume, opportunity analyses, and application pipeline."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={scoreTone(readinessScore)}>Readiness {Math.min(readinessScore, 100)}%</Badge>
            <Button variant="subtle" onClick={() => document.getElementById('mock-interview')?.scrollIntoView({ behavior: 'smooth' })}>
              Start mock
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="md:col-span-2">
          <SectionLabel className="mb-3">Interview readiness dashboard</SectionLabel>
          <div className="flex items-end gap-3 mb-4">
            <span className="text-5xl font-semibold text-white">{Math.min(readinessScore, 100)}%</span>
            <span className="text-sm text-muted mb-2">prepared for the selected role</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Metric label="Interviewing" value={interviewApplications.length} />
            <Metric label="Analyzed jobs" value={analyzedJobs.length} />
            <Metric label="STAR stories" value={resume.stories.length} />
          </div>
        </Card>
        <PrepSignal icon={Target} label="Match score" value={selectedAnalysis ? `${selectedAnalysis.match.atsScore}%` : 'Analyze job'} />
        <PrepSignal icon={TriangleAlert} label="Open gaps" value={weaknesses.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <SectionLabel className="mb-3">Selected job/company context</SectionLabel>
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold text-white">{selectedJob ? `${selectedJob.company} · ${selectedJob.role}` : 'No job selected'}</h3>
              <p className="text-sm text-muted mt-1">{selectedApplication ? `Application stage: ${selectedApplication.stage}` : 'Choose an opportunity to build a prep plan.'}</p>
            </div>
            {jobs.length > 0 && (
              <select
                value={selectedJob?.id ?? ''}
                onChange={(event) => setSelectedJobId(event.target.value)}
                className="bg-base border border-edge-2 rounded px-3 py-2 text-sm text-ink-2 focus:outline-none focus:border-[#555]"
                aria-label="Select interview prep job"
              >
                {jobs.map((job) => <option key={job.id} value={job.id}>{job.company} — {job.role}</option>)}
              </select>
            )}
          </div>
          <p className="text-sm text-ink-3 leading-6 line-clamp-4">{selectedJob?.description ?? 'Add a job description to generate company-specific topics, mock prompts, and weakness tracking.'}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {(selectedAnalysis?.match.matched ?? selectedJob?.tags ?? []).slice(0, 8).map((item) => <Badge key={item} tone="emerald">{item}</Badge>)}
          </div>
        </Card>

        <Card>
          <SectionLabel className="mb-3">Daily Study Plan</SectionLabel>
          <StudyItem day="Today" task={`Review ${weaknesses[0] ?? technicalTopics[0] ?? 'core fundamentals'} and write a 5-minute explanation.`} />
          <StudyItem day="Tomorrow" task="Run one mock interview prompt and tighten the opening story." />
          <StudyItem day="Next" task="Sketch one architecture diagram and name scaling tradeoffs." />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PrepCard icon={Code2} title="Technical Topics" items={technicalTopics} empty="Analyze a job or add resume skills to seed technical topics." />
        <PrepCard id="mock-interview" icon={MessageSquareText} title="Mock Interview" items={[...MOCK_PROMPTS, ...storyBank.map((story) => `Practice STAR: ${story.title}`)].slice(0, 7)} empty="Add STAR stories to your Master Resume to personalize prompts." />
        <PrepCard icon={BrainCircuit} title="Architecture/System Design" items={architectureSeeds.map((topic) => `Prepare a design discussion around ${topic}.`)} empty="Add projects or run a job analysis to seed architecture drills." />
        <PrepCard icon={BookOpenCheck} title="Weakness Tracker" items={weaknesses.map((gap) => `Close gap: ${gap}`)} empty="No role-specific gaps detected yet." />
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-edge-2 bg-base p-3"><div className="text-lg font-semibold text-white">{value}</div><div className="text-xs text-muted">{label}</div></div>
}

function PrepSignal({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return <Card><Icon size={20} className="text-indigo-300 mb-4" aria-hidden /><SectionLabel>{label}</SectionLabel><div className="text-2xl font-semibold text-white mt-2">{value}</div></Card>
}

function StudyItem({ day, task }: { day: string; task: string }) {
  return <div className="flex gap-3 py-3 border-b border-edge last:border-0"><CalendarDays size={16} className="text-faint mt-0.5 shrink-0" aria-hidden /><div><div className="text-sm font-medium text-white">{day}</div><p className="text-sm text-muted mt-1">{task}</p></div></div>
}

function PrepCard({ id, icon: Icon, title, items, empty }: { id?: string; icon: LucideIcon; title: string; items: string[]; empty: string }) {
  return (
    <Card id={id}>
      <div className="flex items-center gap-2 mb-4"><Icon size={18} className="text-indigo-300" aria-hidden /><SectionLabel>{title}</SectionLabel></div>
      {items.length === 0 ? <p className="text-sm text-muted">{empty}</p> : <ul className="space-y-3">{items.map((item) => <li key={item} className="text-sm text-ink-3 leading-6 flex gap-2"><span className="mt-2 size-1.5 rounded-full bg-ink-3 shrink-0" />{item}</li>)}</ul>}
    </Card>
  )
}
