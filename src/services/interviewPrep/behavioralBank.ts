import type { JobOpportunity } from '@/types/job'
import type { PrepDifficulty, PrepQuestion } from '@/types/interviewPrep'

// Job-agnostic STAR behavioral prompts, lightly personalized with the target company and role.

interface BehavioralTemplate {
  topic: string
  difficulty: PrepDifficulty
  question: (context: { company: string; role: string }) => string
  whyInterviewersAsk: string
  commonMistakes: string[]
  followUps: string[]
}

const BEHAVIORAL_TEMPLATES: BehavioralTemplate[] = [
  {
    topic: 'Ownership',
    difficulty: 'beginner',
    question: ({ role }) =>
      `Tell me about a time you took ownership of a problem outside your explicit responsibilities as a ${role}.`,
    whyInterviewersAsk:
      'Ownership signals whether you drive outcomes or wait to be told what to do.',
    commonMistakes: [
      'Describing a team effort without clarifying your specific contribution.',
      'Choosing an example with no measurable result.',
    ],
    followUps: ['What would you do differently?', 'How did others react to you stepping in?'],
  },
  {
    topic: 'Conflict',
    difficulty: 'intermediate',
    question: () =>
      'Describe a disagreement with a coworker or manager about a technical decision. How did you resolve it?',
    whyInterviewersAsk:
      'Interviewers want to see you can disagree respectfully and reach a decision without damaging the relationship.',
    commonMistakes: [
      'Framing the other person as entirely wrong.',
      'Avoiding the conflict instead of resolving it.',
    ],
    followUps: ['What did you learn about the other perspective?', 'Would you handle it differently now?'],
  },
  {
    topic: 'Failure',
    difficulty: 'intermediate',
    question: () => 'Tell me about a project or decision that failed. What happened and what did you learn?',
    whyInterviewersAsk: 'Owning failure honestly shows self-awareness and growth.',
    commonMistakes: [
      'Picking a "failure" that is secretly a humblebrag.',
      'Blaming external factors without owning your part.',
    ],
    followUps: ['What early signal did you miss?', 'What changed in how you work afterward?'],
  },
  {
    topic: 'Impact',
    difficulty: 'beginner',
    question: ({ company }) =>
      `What is a piece of work you are most proud of, and what impact would that kind of contribution have at ${company}?`,
    whyInterviewersAsk: 'Connects your strengths to value the company cares about.',
    commonMistakes: [
      'Describing effort rather than outcome.',
      'Failing to quantify or contextualize the impact.',
    ],
    followUps: ['How did you measure the impact?', 'Who else benefited from it?'],
  },
  {
    topic: 'Ambiguity',
    difficulty: 'advanced',
    question: () =>
      'Tell me about a time you had to make progress with unclear requirements or missing information.',
    whyInterviewersAsk: 'Senior work is rarely fully specified; this tests how you create clarity.',
    commonMistakes: [
      'Waiting for perfect requirements before acting.',
      'Making assumptions without validating them.',
    ],
    followUps: ['How did you validate your assumptions?', 'What tradeoff did you accept to move forward?'],
  },
  {
    topic: 'Learning',
    difficulty: 'beginner',
    question: ({ role }) =>
      `Describe a time you had to learn a new technology or domain quickly for a ${role}-level responsibility.`,
    whyInterviewersAsk: 'Learning speed predicts how fast you ramp on their stack.',
    commonMistakes: ['Listing what you learned without showing how.', 'No concrete application of the new skill.'],
    followUps: ['How do you know when you have learned enough to be effective?', 'What resources did you rely on?'],
  },
  {
    topic: 'Leadership',
    difficulty: 'advanced',
    question: () =>
      'Tell me about a time you influenced a decision or brought a team along without formal authority.',
    whyInterviewersAsk: 'Influence without authority is a hallmark of senior engineers.',
    commonMistakes: ['Confusing being right with being persuasive.', 'Ignoring stakeholders who disagreed.'],
    followUps: ['How did you handle people who pushed back?', 'What made your argument land?'],
  },
]

/** Deterministic behavioral questions tailored to the target job (if provided). */
export function behavioralQuestions(job?: Pick<JobOpportunity, 'company' | 'role'>): PrepQuestion[] {
  const context = { company: job?.company?.trim() || 'this company', role: job?.role?.trim() || 'engineer' }
  return BEHAVIORAL_TEMPLATES.map((template) => ({
    id: `behavioral-${template.topic.toLocaleLowerCase()}`,
    category: 'behavioral' as const,
    difficulty: template.difficulty,
    question: template.question(context),
    topic: template.topic,
    priority: 'resume-core' as const,
    whyInterviewersAsk: template.whyInterviewersAsk,
    commonMistakes: template.commonMistakes,
    followUps: template.followUps,
  }))
}
