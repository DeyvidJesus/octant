import type { CareerFact, CareerKnowledgeBase, FactStatus, KnowledgeSkill, Provenance } from '@/types/resume'
import type { JobOpportunity } from '@/types/job'
import { projectKnowledgeBase } from '@/services/resume/projection'
import { createId } from '@/utils/id'
import { nowIso } from '@/utils/dates'

const SOURCE = 'src/constants/seedData.ts (CareerOS v2 Master Resume seed)'
const provenance = (excerpt: string, notes?: string): Provenance => ({ source: SOURCE, excerpt, notes })

function fact(
  id: string, type: CareerFact['type'], statement: string, roleIds: string[], initiativeIds: string[], skillIds: string[],
  status: FactStatus = 'confirmed', metricIds: string[] = [], tags: string[] = [],
): CareerFact {
  return { id, type, statement, status, roleIds, initiativeIds, skillIds, metricIds, tags, provenance: provenance(statement) }
}

function skill(canonical: string, category: string, proficiency: 1 | 2 | 3 | 4 | 5, favorite = false): KnowledgeSkill {
  return { id: `skill-${canonical.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`, canonical, category, proficiency, favorite, evidenceFactIds: [], provenance: provenance(`${canonical} (${category}, self-assessed level ${proficiency})`) }
}

/** The only persisted starting point for a new CareerOS installation. */
export function createSeedKnowledgeBase(): CareerKnowledgeBase {
  const skills = [
    skill('React', 'Frontend', 5, true), skill('Next.js', 'Frontend', 5, true), skill('TypeScript', 'Frontend', 5, true),
    skill('JavaScript', 'Frontend', 5), skill('HTML', 'Frontend', 5), skill('CSS', 'Frontend', 4),
    skill('Accessibility (WCAG)', 'Frontend', 4), skill('SEO', 'Frontend', 4), skill('Core Web Vitals', 'Frontend', 4),
    skill('Node.js', 'Backend', 4), skill('Java', 'Backend', 4, true), skill('Spring Boot', 'Backend', 4, true),
    skill('REST APIs', 'Backend', 5), skill('GraphQL', 'Backend', 4), skill('Authentication', 'Backend', 3),
    skill('PostgreSQL', 'Databases', 4), skill('MySQL', 'Databases', 3), skill('Docker', 'Cloud', 3),
    skill('AWS', 'Cloud', 2), skill('CI/CD', 'Cloud', 3), skill('Git', 'Cloud', 5), skill('Claude', 'AI', 4),
    skill('OpenAI APIs', 'AI', 4), skill('Prompt Engineering', 'AI', 4), skill('Product Engineering', 'Practices', 4),
    skill('System Architecture', 'Practices', 3), skill('Communication', 'Practices', 4), skill('Ownership', 'Practices', 5),
    skill('E-commerce', 'Practices', 4), skill('SaaS', 'Practices', 4), skill('Performance Optimization', 'Practices', 4),
  ]
  const id = (canonical: string) => `skill-${canonical.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`

  const facts = [
    fact('fact-econverse-headless', 'responsibility', 'Develop and maintain enterprise Headless Commerce applications using React and Next.js.', ['role-econverse'], ['initiative-econverse-commerce'], [id('React'), id('Next.js'), id('E-commerce')]),
    fact('fact-econverse-graphql', 'technical_capability', 'Integrate complex GraphQL APIs and implement reusable component systems.', ['role-econverse'], ['initiative-econverse-commerce'], [id('GraphQL'), id('React')]),
    fact('fact-econverse-performance', 'achievement', 'Optimize application performance, significantly improving Core Web Vitals (CLS, LCP) and Lighthouse metrics.', ['role-econverse'], ['initiative-econverse-commerce'], [id('Core Web Vitals'), id('Performance Optimization')], 'confirmed', ['metric-core-web-vitals']),
    fact('fact-econverse-seo-a11y', 'responsibility', 'Ensure high standards for SEO and WCAG accessibility across platforms.', ['role-econverse'], ['initiative-econverse-commerce'], [id('SEO'), id('Accessibility (WCAG)')]),
    fact('fact-econverse-product', 'stakeholder_interaction', 'Collaborate closely with design and product teams to translate business requirements into features.', ['role-econverse'], ['initiative-econverse-commerce'], [id('Product Engineering'), id('Communication')]),
    fact('fact-econverse-architecture', 'technical_capability', 'Participate actively in architecture discussions and code reviews.', ['role-econverse'], ['initiative-econverse-commerce'], [id('System Architecture')]),
    fact('fact-freelance-systems', 'achievement', 'Delivered complete web systems, landing pages, and administrative dashboards for international clients.', ['role-freelance'], ['initiative-freelance-web'], [id('React'), id('Node.js')]),
    fact('fact-freelance-email', 'achievement', 'Engineered an Email Signature Management Platform end-to-end: gathered requirements, designed the solution, and delivered the production system.', ['role-freelance'], ['initiative-email-signature'], [id('Product Engineering'), id('System Architecture')]),
    fact('fact-freelance-client', 'client_interaction', 'Managed end-to-end client communication, project scoping, and post-launch support.', ['role-freelance'], ['initiative-freelance-web', 'initiative-email-signature'], [id('Communication'), id('Ownership')]),
    fact('fact-gomech-backend', 'technical_capability', 'Architected a multi-tenant backend using Java and Spring Boot with PostgreSQL.', [], ['initiative-gomech'], [id('Java'), id('Spring Boot'), id('PostgreSQL'), id('SaaS'), id('System Architecture')]),
    fact('fact-gomech-ai', 'technical_capability', 'Integrated advanced AI features including a chatbot with tenant-aware context and dynamic SQL workflows via OpenAI APIs.', [], ['initiative-gomech'], [id('OpenAI APIs')]),
    fact('fact-gomech-frontend', 'technical_capability', 'Developed a modern, responsive frontend using React and Next.js.', [], ['initiative-gomech'], [id('React'), id('Next.js')]),
    fact('fact-gomech-docker', 'technical_capability', 'Containerized the application stack using Docker focusing on cloud-oriented design and automation.', [], ['initiative-gomech'], [id('Docker'), id('CI/CD')]),
    fact('fact-story-situation', 'situation', 'A high-traffic Headless Commerce storefront was failing Core Web Vitals, hurting SEO rankings.', ['role-econverse'], ['initiative-econverse-commerce'], [id('Core Web Vitals'), id('SEO')]),
    fact('fact-story-task', 'task', 'Own the performance work and bring CLS and LCP into the green without regressing features.', ['role-econverse'], ['initiative-econverse-commerce'], [id('Core Web Vitals'), id('Ownership')]),
    fact('fact-story-action', 'action', 'Profiled rendering, deferred non-critical work, optimized images and hydration, and enforced budgets in review.', ['role-econverse'], ['initiative-econverse-commerce'], [id('Core Web Vitals'), id('Performance Optimization')]),
    fact('fact-story-result', 'result', 'Moved CLS and LCP into passing ranges and improved Lighthouse scores, protecting organic traffic.', ['role-econverse'], ['initiative-econverse-commerce'], [id('Core Web Vitals'), id('Performance Optimization'), id('SEO')], 'confirmed', ['metric-core-web-vitals']),
    fact('todo-profile-links', 'technical_capability', 'TODO: Add email, phone, GitHub, LinkedIn, website, and work-authorization details.', [], [], [], 'todo'),
    fact('todo-philosophy', 'communication', 'TODO: Add a concise career philosophy statement distinct from the existing engineering values.', [], [], [], 'todo'),
    fact('todo-earlier-history', 'responsibility', 'TODO: Add all professional experiences before Econverse and Freelance, including dates, employers, roles, and evidence.', [], [], [], 'todo'),
    fact('todo-credentials', 'technical_capability', 'TODO: Add education, certifications, and completed learning records.', [], [], [], 'todo'),
    fact('todo-portfolio', 'achievement', 'TODO: Add portfolio URLs, repositories, live demos, write-ups, and talks.', [], [], [], 'todo'),
    fact('todo-metrics', 'result', 'TODO: Add quantified business outcomes, baselines, timeframes, and measurement methods for each relevant achievement.', [], [], [], 'todo'),
    fact('todo-cloud-testing', 'technical_capability', 'TODO: Add verified AWS/cloud deployment, testing, and CI/CD implementation evidence.', [], [], [], 'todo'),
    fact('todo-leadership', 'leadership', 'TODO: Add leadership, mentoring, stakeholder, failure, and lesson stories with concrete situations and outcomes.', [], [], [], 'todo'),
    fact('todo-role-context', 'situation', 'TODO: Add missing situation, task, decision, metric, business-value, and product-impact detail for Econverse and Freelance work.', ['role-econverse', 'role-freelance'], [], [], 'todo'),
  ]

  const skillsWithEvidence = skills.map((entry) => ({ ...entry, evidenceFactIds: facts.filter((entryFact) => entryFact.skillIds.includes(entry.id) && entryFact.status === 'confirmed').map((entryFact) => entryFact.id) }))
  return {
    schemaVersion: 3,
    profile: {
      personal: { name: 'Deyvid Gondim', role: 'Software Engineer', location: 'Brazil (Remote)', timezone: 'America/Sao_Paulo (GMT-3)' },
      summary: 'Software Engineer with ~3 years of experience focused on Product Engineering, Software Architecture, and delivering business value. Proven track record in enterprise Headless Commerce and multi-tenant SaaS applications. Strong dual-stack proficiency (React/Next.js and Java/Spring Boot) with hands-on experience integrating AI workflows.',
      careerDirection: 'To become a highly technical Product Engineer, Software Architect, Tech Lead, CTO, and eventually founder of multiple software companies. Seeking international remote opportunities in product/SaaS companies that value software quality, cloud architecture, and business-oriented engineering.',
      values: ['Technology as a tool to solve business problems', 'Clean code, maintainability, and scalability', 'Performance, SEO, and Accessibility', 'Strong communication and active feedback', 'Mentorship and continuous learning'],
      workPreferences: ['International remote opportunities', 'Product/SaaS companies'],
      languages: [{ id: 'language-portuguese', name: 'Portuguese', level: 'Native', provenance: provenance('Portuguese — Native') }, { id: 'language-english', name: 'English', level: 'C1 (Professional Working Proficiency)', provenance: provenance('English — C1 (Professional Working Proficiency)') }],
    },
    organizations: [
      { id: 'org-econverse', name: 'Econverse', type: 'employer', provenance: provenance('Econverse') },
      { id: 'org-freelance', name: 'Freelance', type: 'personal', provenance: provenance('Freelance') },
    ],
    roles: [
      { id: 'role-econverse', organizationId: 'org-econverse', title: 'Software Engineer (Promoted from Trainee)', period: 'June 2024 - Present', provenance: provenance('Econverse | Software Engineer (Promoted from Trainee) | June 2024 - Present') },
      { id: 'role-freelance', organizationId: 'org-freelance', title: 'Full Stack Engineer', period: '2023 - Present', provenance: provenance('Freelance | Full Stack Engineer | 2023 - Present') },
    ],
    initiatives: [
      { id: 'initiative-econverse-commerce', name: 'Enterprise Headless Commerce Applications', type: 'employment_project', roleIds: ['role-econverse'], technologySkillIds: [id('React'), id('Next.js'), id('GraphQL')], provenance: provenance('Econverse enterprise Headless Commerce applications') },
      { id: 'initiative-freelance-web', name: 'International Client Web Systems', type: 'freelance_engagement', roleIds: ['role-freelance'], technologySkillIds: [id('React'), id('Node.js')], provenance: provenance('Web systems, landing pages, and administrative dashboards for international clients') },
      { id: 'initiative-email-signature', name: 'Email Signature Management Platform', type: 'freelance_engagement', roleIds: ['role-freelance'], technologySkillIds: [id('Product Engineering'), id('System Architecture')], provenance: provenance('Email Signature Management Platform') },
      { id: 'initiative-gomech', name: 'GoMech (Full Stack SaaS)', type: 'portfolio_project', description: 'Multi-tenant management platform for mechanical workshops.', roleIds: [], technologySkillIds: [id('React'), id('Next.js'), id('TypeScript'), id('Java'), id('Spring Boot'), id('PostgreSQL'), id('Docker')], provenance: provenance('GoMech (Full Stack SaaS)') },
    ],
    skills: skillsWithEvidence,
    facts,
    metrics: [{ id: 'metric-core-web-vitals', statement: 'Improved Core Web Vitals (CLS, LCP)', kind: 'qualitative', factIds: ['fact-econverse-performance', 'fact-story-result'], status: 'confirmed', provenance: provenance('Improved Core Web Vitals (CLS, LCP)') }],
    technicalDecisions: [
      { id: 'decision-gomech-multitenancy', context: 'Multi-tenant management platform for mechanical workshops.', selectedApproach: 'Architected a multi-tenant backend using Java and Spring Boot with PostgreSQL.', optionsConsidered: [], tradeoffs: [], initiativeIds: ['initiative-gomech'], roleIds: [], factIds: ['fact-gomech-backend'], status: 'confirmed', provenance: provenance('Architected a multi-tenant backend using Java and Spring Boot with PostgreSQL.') },
      { id: 'decision-gomech-containerization', context: 'GoMech (Full Stack SaaS).', selectedApproach: 'Containerized the application stack using Docker focusing on cloud-oriented design and automation.', optionsConsidered: [], tradeoffs: [], initiativeIds: ['initiative-gomech'], roleIds: [], factIds: ['fact-gomech-docker'], status: 'confirmed', provenance: provenance('Containerized the application stack using Docker focusing on cloud-oriented design and automation.') },
    ],
    stories: [{ id: 'story-core-web-vitals', title: 'Rescuing Core Web Vitals on a flagship storefront', situationFactIds: ['fact-story-situation'], taskFactIds: ['fact-story-task'], actionFactIds: ['fact-story-action'], resultFactIds: ['fact-story-result'], skillIds: [id('Core Web Vitals'), id('Performance Optimization'), id('SEO')], competencies: ['ownership', 'technical depth'], roleIds: ['role-econverse'], tags: ['performance', 'frontend'], status: 'confirmed', provenance: provenance('Rescuing Core Web Vitals on a flagship storefront') }],
    credentials: [], portfolioAssets: [], publications: [], learning: [], unclassifiedFacts: [], updatedAt: nowIso(),
  }
}

/** Compatibility helper for existing deterministic consumers and tests. */
export function createSeedResume() {
  return projectKnowledgeBase(createSeedKnowledgeBase())
}

/** A truly empty knowledge base — the real starting point for a new account. */
export function createEmptyKnowledgeBase(): CareerKnowledgeBase {
  return {
    schemaVersion: 3,
    profile: {
      personal: { name: '', role: '', location: '' },
      summary: '',
      careerDirection: '',
      values: [],
      workPreferences: [],
      languages: [],
    },
    organizations: [],
    roles: [],
    initiatives: [],
    skills: [],
    facts: [],
    metrics: [],
    technicalDecisions: [],
    stories: [],
    credentials: [],
    portfolioAssets: [],
    publications: [],
    learning: [],
    unclassifiedFacts: [],
    updatedAt: nowIso(),
  }
}

/**
 * Whether to preload the demo persona instead of a blank slate. OFF by default: real users start
 * empty and populate via onboarding / the Knowledge Base. Opt in with VITE_DEMO_SEED=true for demos.
 */
// Read defensively: `import.meta.env` is a Vite-only global. This module is also imported by the
// Deno discovery worker (for createEmptyKnowledgeBase), where `import.meta.env` is undefined —
// accessing `.VITE_DEMO_SEED` directly would throw at module load and crash the function. The
// optional-chained cast reads the flag in the browser and safely yields `false` in Deno.
export const DEMO_SEED_ENABLED =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_DEMO_SEED === 'true'

/** Initial knowledge base for a fresh store — persona only in demo mode, otherwise empty. */
export function initialKnowledgeBase(): CareerKnowledgeBase {
  return DEMO_SEED_ENABLED ? createSeedKnowledgeBase() : createEmptyKnowledgeBase()
}

/** Initial jobs for a fresh store — persona only in demo mode, otherwise empty. */
export function initialJobs(): JobOpportunity[] {
  return DEMO_SEED_ENABLED ? createSeedJobs() : []
}

interface SeedJobInput { company: string; role: string; category: string; stack: string; exp: string; salary: string; link: string }
const SEED_JOBS: SeedJobInput[] = [
  { company: 'Tempo', role: 'Full-Stack Engineer', category: 'AI/SaaS', stack: 'TypeScript, React, Tailwind, Supabase', exp: '2+ years', salary: '$40k-$60k', link: 'https://jobs.ashbyhq.com/tempo/374cb123-0dde-427f-a907-e59b66d14624' },
  { company: 'Concentrate AI', role: 'Full-Stack Engineer', category: 'AI/SaaS', stack: 'TypeScript, Node, React, Next, PostgreSQL', exp: '2+ years', salary: 'Competitive', link: 'https://jobs.ashbyhq.com/concentrate%20ai/c603e7c5-3e26-4dce-97a5-c445685e388c' },
  { company: 'Bluepina', role: 'Founding Full-Stack Engineer', category: 'AI/SaaS', stack: 'Node, TypeScript, Next, PostgreSQL', exp: 'Founding', salary: '$160k-$220k', link: 'https://wellfound.com/jobs/4463395-founding-full-stack-software-engineer-remote-clone' },
  { company: 'Reacher', role: 'Software Engineer - Latam', category: 'AI/SaaS', stack: 'TypeScript, React, Python, FastAPI', exp: '2-6 years', salary: '$60k-$85k', link: 'https://jobs.ashbyhq.com/reacher/e4d436eb-dd77-44d0-9586-44d48ad84aea' },
  { company: 'XBOW', role: 'Software Engineer - AI', category: 'AI/SaaS', stack: 'TypeScript, Node, Python, LLMs', exp: 'Mid-level', salary: '$100k-$350k', link: 'https://jobs.ashbyhq.com/xbowcareers/304f9f4e-477e-4d29-a39a-7c212738a0c8' },
  { company: 'NDEAVOUR', role: 'Regular Full-Stack Engineer', category: 'Enterprise', stack: 'Java, Spring Boot, React, REST APIs', exp: 'Mid-level', salary: 'Competitive', link: 'https://jobs.ashbyhq.com/ndeavour/4411587d-7994-4cd7-8ce3-d7000966e0be' },
  { company: 'Addi', role: 'Backend JVM Engineer', category: 'Enterprise', stack: 'Java, Spring Boot, SQL, Docker', exp: '3-5 years', salary: 'Competitive', link: 'https://jobs.ashbyhq.com/addi/97f0cd1b-ccae-4b31-9878-2d90da42bae1' },
  { company: 'Builder.io', role: 'Software Engineer', category: 'DevTools', stack: 'React, TypeScript, Node.js, REST APIs', exp: '3-5+ years', salary: 'Competitive', link: 'https://job-boards.greenhouse.io/builder/jobs/6020728004' },
  { company: 'OpenSesame', role: 'Software Engineer', category: 'DevTools', stack: 'TypeScript, Node, React', exp: '2-4 years', salary: 'Competitive', link: 'https://job-boards.greenhouse.io/opensesame/jobs/7927745' },
  { company: 'Maze', role: 'Senior Full Stack Engineer', category: 'DevTools', stack: 'TypeScript, React, Next, Node, GraphQL', exp: 'Senior/Mid', salary: '$130k-$155k', link: 'https://jobs.ashbyhq.com/mazedesign/691d243c-5da9-4afe-b6dc-52794e4e0de1' },
  { company: 'Truelogic', role: 'Senior Full-Stack Engineer', category: 'Agency', stack: 'TypeScript, Node, React, Postgres, AWS', exp: '5+ years', salary: 'Competitive', link: 'https://jobs.ashbyhq.com/truelogic/d7f844a2-06dd-4f19-b2b7-ec5d3da72a6f' },
  { company: 'WellTheory', role: 'Software Engineer - Implementation', category: 'Specialized', stack: 'JavaScript, TypeScript, React, Node, Postgres', exp: '3-5+ years', salary: 'Competitive', link: 'https://jobs.ashbyhq.com/welltheory/da3432c6-66da-450b-b9f9-f1e66b6482c9' },
]

export function createSeedJobs(): JobOpportunity[] {
  return SEED_JOBS.map((job) => ({ id: createId(), company: job.company, role: job.role, description: `${job.role} at ${job.company} (${job.category}). Remote position. Required stack: ${job.stack}. Experience level: ${job.exp}. Salary: ${job.salary}.`, url: job.link, category: job.category, salaryRange: job.salary, workMode: 'remote', tags: [job.category, job.exp], createdAt: nowIso(), archived: false, source: 'manual' }))
}
