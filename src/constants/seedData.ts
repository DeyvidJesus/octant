import type { Accomplishment, MasterResume } from '@/types/resume'
import type { JobOpportunity } from '@/types/job'
import { createId } from '@/utils/id'
import { nowIso } from '@/utils/dates'

function accomplishment(text: string, skills: string[], metric?: string): Accomplishment {
  return { id: createId(), text, skills, keywords: skills, metric }
}

/**
 * Initial data migrated from the original prototype, expanded to the rich
 * model. Used to seed the stores on first run (or after "Reset to seed data").
 */
export function createSeedResume(): MasterResume {
  return {
    personal: {
      name: 'Deyvid Gondim',
      role: 'Software Engineer',
      location: 'Brazil (Remote)',
      timezone: 'America/Sao_Paulo (GMT-3)',
    },
    summary:
      'Software Engineer with ~3 years of experience focused on Product Engineering, Software Architecture, and delivering business value. Proven track record in enterprise Headless Commerce and multi-tenant SaaS applications. Strong dual-stack proficiency (React/Next.js and Java/Spring Boot) with hands-on experience integrating AI workflows.',
    goals:
      'To become a highly technical Product Engineer, Software Architect, Tech Lead, CTO, and eventually founder of multiple software companies. Seeking international remote opportunities in product/SaaS companies that value software quality, cloud architecture, and business-oriented engineering.',
    values: [
      'Technology as a tool to solve business problems',
      'Clean code, maintainability, and scalability',
      'Performance, SEO, and Accessibility',
      'Strong communication and active feedback',
      'Mentorship and continuous learning',
    ],
    experience: [
      {
        id: createId(),
        company: 'Econverse',
        role: 'Software Engineer (Promoted from Trainee)',
        duration: 'June 2024 - Present',
        accomplishments: [
          accomplishment('Develop and maintain enterprise Headless Commerce applications using React and Next.js.', ['React', 'Next.js', 'E-commerce']),
          accomplishment('Integrate complex GraphQL APIs and implement reusable component systems.', ['GraphQL', 'React']),
          accomplishment('Optimize application performance, significantly improving Core Web Vitals (CLS, LCP) and Lighthouse metrics.', ['Core Web Vitals', 'Performance Optimization'], 'Improved Core Web Vitals (CLS, LCP)'),
          accomplishment('Ensure high standards for SEO and WCAG accessibility across platforms.', ['SEO', 'Accessibility (WCAG)']),
          accomplishment('Collaborate closely with design and product teams to translate business requirements into features.', ['Product Engineering', 'Communication']),
          accomplishment('Participate actively in architecture discussions and code reviews.', ['System Architecture', 'Code Review']),
        ],
      },
      {
        id: createId(),
        company: 'Freelance',
        role: 'Full Stack Engineer',
        duration: '2023 - Present',
        accomplishments: [
          accomplishment('Delivered complete web systems, landing pages, and administrative dashboards for international clients.', ['React', 'Node.js']),
          accomplishment('Engineered an Email Signature Management Platform end-to-end: gathered requirements, designed the solution, and delivered the production system.', ['Product Engineering', 'System Architecture']),
          accomplishment('Managed end-to-end client communication, project scoping, and post-launch support.', ['Communication', 'Ownership']),
        ],
      },
    ],
    projects: [
      {
        id: createId(),
        name: 'GoMech (Full Stack SaaS)',
        tech: ['React', 'Next.js', 'TypeScript', 'Java', 'Spring Boot', 'PostgreSQL', 'Docker'],
        description: 'Multi-tenant management platform for mechanical workshops.',
        accomplishments: [
          accomplishment('Architected a multi-tenant backend using Java and Spring Boot with PostgreSQL.', ['Java', 'Spring Boot', 'PostgreSQL', 'SaaS', 'System Architecture']),
          accomplishment('Integrated advanced AI features including a chatbot with tenant-aware context and dynamic SQL workflows via OpenAI APIs.', ['OpenAI APIs', 'LLMs']),
          accomplishment('Developed a modern, responsive frontend using React and Next.js.', ['React', 'Next.js']),
          accomplishment('Containerized the application stack using Docker focusing on cloud-oriented design and automation.', ['Docker', 'CI/CD']),
        ],
      },
    ],
    skills: [
      skill('React', 'Frontend', 5, true),
      skill('Next.js', 'Frontend', 5, true),
      skill('TypeScript', 'Frontend', 5, true),
      skill('JavaScript', 'Frontend', 5),
      skill('HTML', 'Frontend', 5),
      skill('CSS', 'Frontend', 4),
      skill('Accessibility (WCAG)', 'Frontend', 4),
      skill('SEO', 'Frontend', 4),
      skill('Core Web Vitals', 'Frontend', 4),
      skill('Node.js', 'Backend', 4),
      skill('Java', 'Backend', 4, true),
      skill('Spring Boot', 'Backend', 4, true),
      skill('REST APIs', 'Backend', 5),
      skill('GraphQL', 'Backend', 4),
      skill('Authentication', 'Backend', 3),
      skill('PostgreSQL', 'Databases', 4),
      skill('MySQL', 'Databases', 3),
      skill('Docker', 'Cloud', 3),
      skill('AWS', 'Cloud', 2),
      skill('CI/CD', 'Cloud', 3),
      skill('Git', 'Cloud', 5),
      skill('Claude', 'AI', 4),
      skill('OpenAI APIs', 'AI', 4),
      skill('Prompt Engineering', 'AI', 4),
      skill('Product Engineering', 'Practices', 4),
      skill('System Architecture', 'Practices', 3),
      skill('Communication', 'Practices', 4),
      skill('Ownership', 'Practices', 5),
    ],
    stories: [
      {
        id: createId(),
        title: 'Rescuing Core Web Vitals on a flagship storefront',
        situation: 'A high-traffic Headless Commerce storefront was failing Core Web Vitals, hurting SEO rankings.',
        task: 'Own the performance work and bring CLS and LCP into the green without regressing features.',
        action: 'Profiled rendering, deferred non-critical work, optimized images and hydration, and enforced budgets in review.',
        result: 'Moved CLS and LCP into passing ranges and improved Lighthouse scores, protecting organic traffic.',
        skills: ['Core Web Vitals', 'Performance Optimization', 'SEO'],
        competencies: ['ownership', 'technical depth'],
        tags: ['performance', 'frontend'],
      },
    ],
    certifications: [],
    education: [],
    publications: [],
    learning: [],
    portfolio: [],
    languages: [
      { id: createId(), name: 'Portuguese', level: 'Native' },
      { id: createId(), name: 'English', level: 'C1 (Professional Working Proficiency)' },
    ],
    updatedAt: nowIso(),
  }
}

function skill(
  canonical: string,
  category: string,
  proficiency: 1 | 2 | 3 | 4 | 5,
  favorite = false,
): MasterResume['skills'][number] {
  return { id: createId(), canonical, category, proficiency, favorite }
}

interface SeedJobInput {
  company: string
  role: string
  category: string
  stack: string
  exp: string
  salary: string
  link: string
}

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
  return SEED_JOBS.map((job) => ({
    id: createId(),
    company: job.company,
    role: job.role,
    description: `${job.role} at ${job.company} (${job.category}). Remote position. Required stack: ${job.stack}. Experience level: ${job.exp}. Salary: ${job.salary}.`,
    url: job.link,
    category: job.category,
    salaryRange: job.salary,
    workMode: 'remote',
    tags: [job.category, job.exp],
    createdAt: nowIso(),
    archived: false,
    source: 'manual',
  }))
}
