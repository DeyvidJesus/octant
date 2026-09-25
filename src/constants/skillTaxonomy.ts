export interface TaxonomyEntry {
  canonical: string
  /** Lowercase alternate spellings as they appear in job descriptions. */
  aliases: string[]
  category: SkillTaxonomyCategory
}

export type SkillTaxonomyCategory =
  | 'frontend'
  | 'backend'
  | 'databases'
  | 'cloud'
  | 'ai'
  | 'practices'

export const SKILL_CATEGORY_LABELS: Record<SkillTaxonomyCategory, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  databases: 'Databases',
  cloud: 'Cloud / Infra',
  ai: 'AI',
  practices: 'Practices',
}

/** The analyzer's skill dictionary; aliases match case-insensitively on term boundaries. */
export const SKILL_TAXONOMY: TaxonomyEntry[] = [
  // Frontend
  { canonical: 'JavaScript', aliases: ['javascript', 'js', 'es6'], category: 'frontend' },
  { canonical: 'TypeScript', aliases: ['typescript', 'ts'], category: 'frontend' },
  { canonical: 'React', aliases: ['react', 'reactjs', 'react.js'], category: 'frontend' },
  { canonical: 'Next.js', aliases: ['next.js', 'nextjs', 'next'], category: 'frontend' },
  { canonical: 'Vue', aliases: ['vue', 'vuejs', 'vue.js', 'nuxt'], category: 'frontend' },
  { canonical: 'Angular', aliases: ['angular'], category: 'frontend' },
  { canonical: 'Svelte', aliases: ['svelte', 'sveltekit'], category: 'frontend' },
  { canonical: 'HTML', aliases: ['html', 'html5'], category: 'frontend' },
  { canonical: 'CSS', aliases: ['css', 'css3', 'sass', 'scss', 'less'], category: 'frontend' },
  { canonical: 'Tailwind CSS', aliases: ['tailwind', 'tailwindcss', 'tailwind css'], category: 'frontend' },
  { canonical: 'Redux', aliases: ['redux'], category: 'frontend' },
  { canonical: 'React Native', aliases: ['react native'], category: 'frontend' },
  { canonical: 'Accessibility (WCAG)', aliases: ['accessibility', 'wcag', 'a11y'], category: 'frontend' },
  { canonical: 'SEO', aliases: ['seo', 'search engine optimization'], category: 'frontend' },
  { canonical: 'Core Web Vitals', aliases: ['core web vitals', 'web vitals', 'lighthouse', 'lcp', 'cls'], category: 'frontend' },
  { canonical: 'Responsive Design', aliases: ['responsive design', 'responsive'], category: 'frontend' },
  { canonical: 'Webpack', aliases: ['webpack'], category: 'frontend' },
  { canonical: 'Vite', aliases: ['vite'], category: 'frontend' },

  // Backend
  { canonical: 'Node.js', aliases: ['node.js', 'nodejs', 'node'], category: 'backend' },
  { canonical: 'Java', aliases: ['java', 'jvm'], category: 'backend' },
  { canonical: 'Spring Boot', aliases: ['spring boot', 'spring', 'springboot'], category: 'backend' },
  { canonical: 'Kotlin', aliases: ['kotlin'], category: 'backend' },
  { canonical: 'Python', aliases: ['python'], category: 'backend' },
  { canonical: 'Django', aliases: ['django'], category: 'backend' },
  { canonical: 'FastAPI', aliases: ['fastapi'], category: 'backend' },
  { canonical: 'Go', aliases: ['golang'], category: 'backend' },
  { canonical: 'C#', aliases: ['c#', '.net', 'dotnet'], category: 'backend' },
  { canonical: 'Ruby on Rails', aliases: ['ruby on rails', 'rails', 'ruby'], category: 'backend' },
  { canonical: 'PHP', aliases: ['php', 'laravel'], category: 'backend' },
  { canonical: 'Rust', aliases: ['rust'], category: 'backend' },
  { canonical: 'Elixir', aliases: ['elixir', 'phoenix'], category: 'backend' },
  { canonical: 'Express', aliases: ['express', 'expressjs', 'express.js'], category: 'backend' },
  { canonical: 'NestJS', aliases: ['nestjs', 'nest.js', 'nest'], category: 'backend' },
  { canonical: 'REST APIs', aliases: ['rest', 'rest api', 'rest apis', 'restful'], category: 'backend' },
  { canonical: 'GraphQL', aliases: ['graphql', 'apollo'], category: 'backend' },
  { canonical: 'gRPC', aliases: ['grpc'], category: 'backend' },
  { canonical: 'WebSockets', aliases: ['websocket', 'websockets'], category: 'backend' },
  { canonical: 'Microservices', aliases: ['microservices', 'microservice'], category: 'backend' },
  { canonical: 'Authentication', aliases: ['authentication', 'oauth', 'oauth2', 'jwt', 'sso'], category: 'backend' },
  { canonical: 'Message Queues', aliases: ['kafka', 'rabbitmq', 'sqs', 'message queue', 'pub/sub'], category: 'backend' },

  // Databases
  { canonical: 'PostgreSQL', aliases: ['postgresql', 'postgres', 'psql'], category: 'databases' },
  { canonical: 'MySQL', aliases: ['mysql', 'mariadb'], category: 'databases' },
  { canonical: 'MongoDB', aliases: ['mongodb', 'mongo'], category: 'databases' },
  { canonical: 'Redis', aliases: ['redis'], category: 'databases' },
  { canonical: 'SQL', aliases: ['sql'], category: 'databases' },
  { canonical: 'NoSQL', aliases: ['nosql', 'dynamodb'], category: 'databases' },
  { canonical: 'Elasticsearch', aliases: ['elasticsearch', 'opensearch'], category: 'databases' },
  { canonical: 'Supabase', aliases: ['supabase'], category: 'databases' },
  { canonical: 'Firebase', aliases: ['firebase', 'firestore'], category: 'databases' },
  { canonical: 'Prisma', aliases: ['prisma'], category: 'databases' },

  // Cloud / Infra
  { canonical: 'AWS', aliases: ['aws', 'amazon web services', 'ec2', 'ecs', 's3', 'lambda'], category: 'cloud' },
  { canonical: 'Google Cloud', aliases: ['gcp', 'google cloud'], category: 'cloud' },
  { canonical: 'Azure', aliases: ['azure'], category: 'cloud' },
  { canonical: 'Docker', aliases: ['docker', 'containers', 'containerization'], category: 'cloud' },
  { canonical: 'Kubernetes', aliases: ['kubernetes', 'k8s'], category: 'cloud' },
  { canonical: 'Terraform', aliases: ['terraform', 'infrastructure as code', 'iac'], category: 'cloud' },
  { canonical: 'CI/CD', aliases: ['ci/cd', 'cicd', 'continuous integration', 'continuous delivery', 'github actions', 'jenkins'], category: 'cloud' },
  { canonical: 'Git', aliases: ['git', 'github', 'gitlab'], category: 'cloud' },
  { canonical: 'Linux', aliases: ['linux', 'unix'], category: 'cloud' },
  { canonical: 'Serverless', aliases: ['serverless'], category: 'cloud' },
  { canonical: 'Vercel', aliases: ['vercel'], category: 'cloud' },
  { canonical: 'Observability', aliases: ['observability', 'monitoring', 'datadog', 'grafana', 'prometheus'], category: 'cloud' },

  // AI
  { canonical: 'OpenAI APIs', aliases: ['openai', 'gpt', 'chatgpt'], category: 'ai' },
  { canonical: 'Claude', aliases: ['claude', 'anthropic'], category: 'ai' },
  { canonical: 'LLMs', aliases: ['llm', 'llms', 'large language model', 'large language models', 'generative ai', 'genai'], category: 'ai' },
  { canonical: 'Prompt Engineering', aliases: ['prompt engineering', 'prompting'], category: 'ai' },
  { canonical: 'RAG', aliases: ['rag', 'retrieval augmented generation', 'embeddings', 'vector database'], category: 'ai' },
  { canonical: 'AI Agents', aliases: ['ai agents', 'agentic', 'mcp'], category: 'ai' },
  { canonical: 'Machine Learning', aliases: ['machine learning', 'ml', 'pytorch', 'tensorflow'], category: 'ai' },
  { canonical: 'AI Tooling', aliases: ['copilot', 'cursor', 'ai tools', 'ai-assisted'], category: 'ai' },

  // Practices / product / testing
  { canonical: 'Testing', aliases: ['testing', 'unit testing', 'unit tests', 'tdd'], category: 'practices' },
  { canonical: 'Jest', aliases: ['jest', 'vitest'], category: 'practices' },
  { canonical: 'Cypress', aliases: ['cypress', 'playwright', 'e2e testing', 'end-to-end testing'], category: 'practices' },
  { canonical: 'Agile', aliases: ['agile', 'scrum', 'kanban'], category: 'practices' },
  { canonical: 'Code Review', aliases: ['code review', 'code reviews', 'pull requests'], category: 'practices' },
  { canonical: 'System Architecture', aliases: ['architecture', 'system design', 'software architecture', 'system architecture'], category: 'practices' },
  { canonical: 'Performance Optimization', aliases: ['performance', 'performance optimization', 'optimization'], category: 'practices' },
  { canonical: 'Product Engineering', aliases: ['product engineering', 'product-minded', 'product mindset', 'product thinking'], category: 'practices' },
  { canonical: 'Mentorship', aliases: ['mentorship', 'mentoring', 'coaching'], category: 'practices' },
  { canonical: 'Communication', aliases: ['communication', 'cross-functional', 'collaboration'], category: 'practices' },
  { canonical: 'Ownership', aliases: ['ownership', 'autonomy', 'self-directed'], category: 'practices' },
  { canonical: 'Remote Work', aliases: ['remote', 'async', 'distributed team'], category: 'practices' },
  { canonical: 'E-commerce', aliases: ['e-commerce', 'ecommerce', 'headless commerce', 'shopify', 'vtex'], category: 'practices' },
  { canonical: 'SaaS', aliases: ['saas', 'multi-tenant', 'b2b'], category: 'practices' },
  { canonical: 'Security', aliases: ['security', 'owasp', 'appsec'], category: 'practices' },
]
