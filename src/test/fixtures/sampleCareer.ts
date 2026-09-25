import type { CareerFact, CareerKnowledgeBase, FactStatus, KnowledgeSkill, Provenance } from '@/types/resume'
import { projectKnowledgeBase } from '@/services/resume/projection'
import { nowIso } from '@/utils/dates'

// Test fixture: a realistic, fully linked knowledge base for the analysis, generator and AI-prompt tests.

const SOURCE = 'test fixture'
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

/** A complete knowledge base: skills with evidence, linked facts, a STAR story and pending facts. */
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
    fact('todo-profile-links', 'technical_capability', 'Contact links and work-authorization details are pending.', [], [], [], 'todo'),
    fact('todo-philosophy', 'communication', 'A short career philosophy statement is pending.', [], [], [], 'todo'),
    fact('todo-earlier-history', 'responsibility', 'Earlier professional experience, with dates and evidence, is pending.', [], [], [], 'todo'),
    fact('todo-credentials', 'technical_capability', 'Education and certification records are pending.', [], [], [], 'todo'),
    fact('todo-portfolio', 'achievement', 'Portfolio links and write-ups are pending.', [], [], [], 'todo'),
    fact('todo-metrics', 'result', 'Quantified outcomes with baselines and timeframes are pending.', [], [], [], 'todo'),
    fact('todo-cloud-testing', 'technical_capability', 'Cloud deployment and CI/CD evidence is pending.', [], [], [], 'todo'),
    fact('todo-leadership', 'leadership', 'Leadership and mentoring stories are pending.', [], [], [], 'todo'),
    fact('todo-role-context', 'situation', 'Situation and business-impact detail for both roles is pending.', ['role-econverse', 'role-freelance'], [], [], 'todo'),
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

/** The fixture projected as a Master Resume. */
export function createSeedResume() {
  return projectKnowledgeBase(createSeedKnowledgeBase())
}
