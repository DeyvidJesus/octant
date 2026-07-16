import type { PrepDifficulty, PrepPriority, PrepQuestion } from '@/types/interviewPrep'

export type InterviewDifficulty = 'junior' | 'early-mid' | 'advanced'

export type StackVariant = {
  stack: 'React/Next.js frontend' | 'Node/Spring Boot backend' | 'PostgreSQL/Supabase database' | 'Docker/AWS deployment'
  notes: string[]
}

export type InterviewQuestionTemplate = {
  topic: string
  question: string
  expectedAnswerOutline: string[]
  whyInterviewersAskThis: string
  commonMistakes: string[]
  followUpQuestions: string[]
  difficulty: InterviewDifficulty
  stackSpecificVariants?: StackVariant[]
}

export const questionBank: InterviewQuestionTemplate[] = [
  {
    topic: 'Authentication',
    question: 'Design authentication for a web application that supports email/password login, logout, password reset, and protected routes.',
    expectedAnswerOutline: [
      'Separate identity concerns from product features with clear login, logout, signup, reset, and session validation APIs.',
      'Store passwords with a slow salted hash, never plaintext, and protect reset flows with short-lived single-use tokens.',
      'Use secure session cookies or well-scoped tokens, describe expiration, refresh, logout, and server-side invalidation tradeoffs.',
      'Model users, credentials, sessions, reset tokens, and optional roles with uniqueness constraints on email.',
      'Mention production basics: HTTPS, rate limiting, audit logs for sensitive events, and helpful but non-leaky error messages.',
    ],
    whyInterviewersAskThis: 'Authentication touches security, API boundaries, data modeling, and user experience, so it reveals whether a candidate can reason about safe defaults without over-engineering.',
    commonMistakes: [
      'Storing raw passwords or inventing a custom hashing/encryption scheme.',
      'Putting long-lived tokens in localStorage without discussing XSS risk or expiration.',
      'Forgetting reset-token expiration, reuse prevention, and generic error responses.',
      'Mixing frontend route hiding with actual backend authorization.',
    ],
    followUpQuestions: [
      'How would you add OAuth login later without rewriting the user model?',
      'How would you handle account lockout or rate limiting without creating an easy denial-of-service vector?',
      'What changes if the app has admin-only routes?',
    ],
    difficulty: 'junior',
    stackSpecificVariants: [
      {
        stack: 'React/Next.js frontend',
        notes: [
          'Use middleware or server components to protect pages that need server-side checks.',
          'Keep auth state resilient to refreshes by validating the session with the backend rather than trusting client state only.',
        ],
      },
      {
        stack: 'Node/Spring Boot backend',
        notes: [
          'Expose small auth endpoints and centralize authorization in middleware, guards, filters, or annotations.',
          'Use established libraries for password hashing, token signing, and session handling.',
        ],
      },
      {
        stack: 'PostgreSQL/Supabase database',
        notes: [
          'Use unique indexes for email and foreign keys from sessions/reset tokens to users.',
          'If using Supabase Auth, explain where application profiles and roles live separately from auth users.',
        ],
      },
    ],
  },
  {
    topic: 'Shopping Cart',
    question: 'Design a shopping cart for an online store where users can add items, update quantities, leave, and come back later.',
    expectedAnswerOutline: [
      'Define APIs for add item, update quantity, remove item, view cart, and convert cart to checkout/order.',
      'Model carts and cart items separately from products so price, availability, and inventory can be checked at checkout.',
      'Discuss guest carts versus logged-in carts and how to merge them after login.',
      'Handle validation for quantity limits, deleted products, price changes, and out-of-stock items.',
      'Mention reliability basics such as idempotent updates, optimistic UI rollback, and server-side totals calculation.',
    ],
    whyInterviewersAskThis: 'A cart is familiar but exposes practical thinking about state ownership, API design, persistence, and edge cases.',
    commonMistakes: [
      'Trusting client-calculated prices or totals.',
      'Not deciding what happens to guest carts at login.',
      'Conflating cart reservation with inventory deduction.',
      'Ignoring stale products, changed prices, and invalid quantities.',
    ],
    followUpQuestions: [
      'When, if ever, should inventory be reserved?',
      'How would you support coupons or promotions?',
      'How would you prevent duplicate checkout submissions?',
    ],
    difficulty: 'junior',
    stackSpecificVariants: [
      {
        stack: 'React/Next.js frontend',
        notes: [
          'Use optimistic updates for quantity changes but reconcile with the server response.',
          'Avoid storing authoritative cart totals only in client state.',
        ],
      },
      {
        stack: 'PostgreSQL/Supabase database',
        notes: [
          'Use cart_items with a unique cart_id/product_id constraint to avoid duplicates.',
          'Keep order line items as a checkout-time snapshot rather than referencing mutable cart rows.',
        ],
      },
    ],
  },
  {
    topic: 'Notifications',
    question: 'Design a notification system for product events such as comments, status changes, and reminders.',
    expectedAnswerOutline: [
      'Identify channels such as in-app, email, and push, and define which are synchronous versus background work.',
      'Model notifications, recipients, read state, user preferences, and delivery attempts.',
      'Use an event or job queue boundary so the main product action does not fail because email delivery is slow.',
      'Discuss deduplication, retries with backoff, and avoiding spam through preferences and batching.',
      'Include observability for failed deliveries and user-facing read/unread behavior.',
    ],
    whyInterviewersAskThis: 'Notifications test whether candidates understand asynchronous work, user preferences, and reliability without jumping straight to complex distributed systems.',
    commonMistakes: [
      'Sending emails directly inside the request path with no retry strategy.',
      'Ignoring unsubscribe and preference controls.',
      'Creating duplicate notifications for retried events.',
      'Not tracking delivery failures or read state.',
    ],
    followUpQuestions: [
      'How would you batch multiple notifications into one email digest?',
      'How would you make notification creation idempotent?',
      'What would you monitor after launch?',
    ],
    difficulty: 'early-mid',
    stackSpecificVariants: [
      {
        stack: 'Node/Spring Boot backend',
        notes: [
          'Use background workers, scheduled jobs, or framework queue integrations for delivery.',
          'Keep notification creation separate from provider-specific email or push code.',
        ],
      },
      {
        stack: 'Docker/AWS deployment',
        notes: [
          'A simple worker container plus SQS or a managed scheduler is often enough for early-stage scale.',
          'Configure dead-letter queues or alerting for repeated provider failures.',
        ],
      },
    ],
  },
  {
    topic: 'Inventory',
    question: 'Design inventory tracking for a small e-commerce or internal warehouse application.',
    expectedAnswerOutline: [
      'Model products, SKUs, stock levels, locations if needed, and inventory adjustments or movements.',
      'Define APIs for viewing stock, receiving stock, adjusting stock, and checking availability during checkout.',
      'Use transactions or conditional updates to avoid selling below zero in normal traffic.',
      'Keep an audit trail of manual adjustments and order-related changes.',
      'Discuss the difference between available, reserved, and sold quantities if checkout is multi-step.',
    ],
    whyInterviewersAskThis: 'Inventory questions reveal whether candidates can model business rules and reason about consistency at a practical level.',
    commonMistakes: [
      'Updating stock without an audit trail or reason code.',
      'Assuming a read-then-write check is safe without transactions or conditional updates.',
      'Failing to define when stock is reserved versus decremented.',
      'Overcomplicating with global distributed locks for a small system.',
    ],
    followUpQuestions: [
      'How would you handle returns?',
      'How would you support multiple warehouses?',
      'What report would operations need to trust the numbers?',
    ],
    difficulty: 'early-mid',
    stackSpecificVariants: [
      {
        stack: 'PostgreSQL/Supabase database',
        notes: [
          'Use transactions, check constraints, and row-level locking or conditional updates for stock changes.',
          'Store inventory_ledger rows so current stock can be audited against historical movement.',
        ],
      },
      {
        stack: 'Node/Spring Boot backend',
        notes: [
          'Put stock mutation rules in service-layer methods rather than scattering updates across controllers.',
        ],
      },
    ],
  },
  {
    topic: 'File Upload',
    question: 'Design file upload for user documents or images, including validation, storage, and later download.',
    expectedAnswerOutline: [
      'Choose direct-to-object-storage uploads or backend-proxied uploads based on file size, security, and implementation complexity.',
      'Validate file size, type, ownership, and scan or quarantine files when risk is meaningful.',
      'Model files with owner, storage key, original filename, content type, size, status, and timestamps.',
      'Use signed URLs or authenticated download endpoints instead of public buckets for private files.',
      'Handle failed uploads, cleanup of orphaned objects, and clear user-facing progress/error states.',
    ],
    whyInterviewersAskThis: 'File upload looks simple but requires candidates to consider security, storage boundaries, metadata, and failure modes.',
    commonMistakes: [
      'Trusting the browser-provided MIME type or extension only.',
      'Storing private files in a public bucket.',
      'Saving large files in the relational database by default.',
      'Not handling orphaned metadata or orphaned storage objects after partial failures.',
    ],
    followUpQuestions: [
      'How would you generate image thumbnails?',
      'How would uploads change for files larger than 100 MB?',
      'How would you ensure users can only access their own files?',
    ],
    difficulty: 'junior',
    stackSpecificVariants: [
      {
        stack: 'React/Next.js frontend',
        notes: [
          'Show upload progress, disabled submit states, and retry options for failed uploads.',
          'For direct uploads, request a signed URL from the backend before uploading to storage.',
        ],
      },
      {
        stack: 'Docker/AWS deployment',
        notes: [
          'Use S3 with presigned URLs and lifecycle rules for temporary or orphaned uploads.',
        ],
      },
    ],
  },
  {
    topic: 'Payment Flow',
    question: 'Design a payment flow for checkout using a third-party payment provider.',
    expectedAnswerOutline: [
      'Keep card handling with the provider and avoid storing sensitive card data in the application.',
      'Create orders or payment intents server-side, calculate totals on the backend, and use idempotency keys for retries.',
      'Model order states such as pending, paid, failed, canceled, refunded, and fulfillment-ready.',
      'Use webhooks to confirm final payment status and verify webhook signatures.',
      'Explain what the user sees for loading, failure, retry, and duplicate submission prevention.',
    ],
    whyInterviewersAskThis: 'Payment flow tests production awareness, third-party integration boundaries, idempotency, and state management.',
    commonMistakes: [
      'Marking an order paid only because the client says payment succeeded.',
      'Ignoring duplicate submits, retries, and webhook verification.',
      'Storing card details directly.',
      'Not reconciling payment provider state with local order state.',
    ],
    followUpQuestions: [
      'How would you handle refunds?',
      'What if the webhook arrives before the browser returns to the success page?',
      'How would you test payments locally?',
    ],
    difficulty: 'early-mid',
    stackSpecificVariants: [
      {
        stack: 'Node/Spring Boot backend',
        notes: [
          'Implement provider calls and webhook handlers on the backend, not in client-only code.',
          'Use idempotency keys when creating payment attempts or orders.',
        ],
      },
      {
        stack: 'PostgreSQL/Supabase database',
        notes: [
          'Persist provider payment IDs and state transitions for reconciliation and support.',
        ],
      },
    ],
  },
  {
    topic: 'Admin Dashboard',
    question: 'Design an admin dashboard for support staff to view users, orders, and operational metrics.',
    expectedAnswerOutline: [
      'Define role-based access control and protect admin APIs separately from normal user APIs.',
      'Model audit logs for sensitive admin actions such as refunds, account changes, and manual overrides.',
      'Provide paginated, filterable endpoints rather than loading all records.',
      'Choose metrics that can be queried safely or precomputed if expensive.',
      'Discuss privacy, least privilege, and clear confirmation flows for destructive actions.',
    ],
    whyInterviewersAskThis: 'Admin tooling tests whether candidates can design internal features with security, usability, and operational needs in mind.',
    commonMistakes: [
      'Only hiding admin UI links while leaving APIs unprotected.',
      'Skipping audit logs for privileged actions.',
      'Building unbounded list endpoints that will slow down with real data.',
      'Exposing more customer data than support staff need.',
    ],
    followUpQuestions: [
      'How would you add different admin roles?',
      'How would you investigate who changed a user account?',
      'How would you make slow dashboard metrics faster?',
    ],
    difficulty: 'junior',
    stackSpecificVariants: [
      {
        stack: 'React/Next.js frontend',
        notes: [
          'Use server-side authorization checks for admin routes and defensive client-side UI states.',
        ],
      },
      {
        stack: 'PostgreSQL/Supabase database',
        notes: [
          'Use indexes for common filters and row-level security policies if Supabase is enforcing access rules.',
        ],
      },
    ],
  },
  {
    topic: 'SaaS Multi-tenancy',
    question: 'Design a basic SaaS app where users belong to organizations and data must stay separated by organization.',
    expectedAnswerOutline: [
      'Model organizations, memberships, roles, invitations, and tenant-owned records with organization_id foreign keys.',
      'Enforce tenant boundaries in backend authorization for every read and write.',
      'Use unique constraints scoped to organization where appropriate, such as project names or member emails.',
      'Discuss shared-database tenancy as a realistic starting point and when separate databases might be considered later.',
      'Include admin/member role differences, invite flows, and audit logs for sensitive tenant actions.',
    ],
    whyInterviewersAskThis: 'Multi-tenancy checks whether candidates understand data ownership, authorization boundaries, and practical SaaS modeling.',
    commonMistakes: [
      'Relying on client-provided organization IDs without verifying membership.',
      'Forgetting organization_id on tenant-owned tables.',
      'Using globally unique business fields when uniqueness should be tenant-scoped.',
      'Jumping to separate databases before explaining simpler shared-table tradeoffs.',
    ],
    followUpQuestions: [
      'How would a user switch between organizations?',
      'How would you invite a teammate safely?',
      'What tests would catch cross-tenant data leaks?',
    ],
    difficulty: 'early-mid',
    stackSpecificVariants: [
      {
        stack: 'PostgreSQL/Supabase database',
        notes: [
          'Use composite unique indexes such as organization_id plus slug or name.',
          'Supabase row-level security can enforce tenant membership, but policies must be tested carefully.',
        ],
      },
      {
        stack: 'Node/Spring Boot backend',
        notes: [
          'Resolve the active organization from authenticated membership and centralize tenant checks in services or middleware.',
        ],
      },
    ],
  },
  {
    topic: 'Caching',
    question: 'Add caching to improve a slow page or API endpoint without serving badly stale or unauthorized data.',
    expectedAnswerOutline: [
      'Identify what is slow and cacheable, such as public catalog data, expensive aggregates, or per-user dashboard summaries.',
      'Choose a cache location: browser, CDN, server memory, Redis, or database materialized view based on data shape and freshness needs.',
      'Define cache keys that include relevant parameters and user or tenant scope when data is not public.',
      'Set expiration and invalidation rules based on acceptable staleness.',
      'Measure hit rate, latency, and correctness after rollout.',
    ],
    whyInterviewersAskThis: 'Caching questions reveal whether candidates can improve performance while respecting correctness and security boundaries.',
    commonMistakes: [
      'Caching personalized data under a public or incomplete key.',
      'Adding cache before measuring the bottleneck.',
      'No invalidation or freshness plan.',
      'Assuming caching fixes inefficient queries forever.',
    ],
    followUpQuestions: [
      'How would you invalidate cached product data after an admin edit?',
      'What data should not be cached?',
      'How would you know the cache is helping?',
    ],
    difficulty: 'early-mid',
    stackSpecificVariants: [
      {
        stack: 'React/Next.js frontend',
        notes: [
          'Use framework data caching carefully and avoid caching authenticated responses as if they were public.',
        ],
      },
      {
        stack: 'Node/Spring Boot backend',
        notes: [
          'Start with endpoint-level or service-level caching for expensive read paths with clear keys and TTLs.',
        ],
      },
      {
        stack: 'Docker/AWS deployment',
        notes: [
          'CloudFront or managed Redis can be useful, but only after choosing safe cache headers and keys.',
        ],
      },
    ],
  },
  {
    topic: 'GraphQL scaling',
    question: 'A GraphQL API is getting slower as the app grows. How would you make it reliable and easier to operate?',
    expectedAnswerOutline: [
      'Start by measuring slow operations, resolver timing, query frequency, and database query counts.',
      'Address N+1 queries with batching or DataLoader-style patterns and clear resolver boundaries.',
      'Add pagination, filtering limits, query depth or complexity limits, and timeouts for expensive operations.',
      'Cache safe reference data or resolver results where freshness and authorization rules are clear.',
      'Treat advanced federation or multi-region architecture as later-stage options, not the first answer for a small team.',
    ],
    whyInterviewersAskThis: 'This checks whether candidates can reason about GraphQL-specific performance issues while staying grounded in everyday backend practices.',
    commonMistakes: [
      'Blaming GraphQL itself without measuring resolvers or database queries.',
      'Returning unpaginated nested collections.',
      'Ignoring authorization inside nested resolvers.',
      'Jumping to advanced platform architecture before fixing N+1 and limits.',
    ],
    followUpQuestions: [
      'How would you find an N+1 query in production?',
      'How would you protect the API from a very expensive query?',
      'When would persisted queries be useful?',
    ],
    difficulty: 'early-mid',
    stackSpecificVariants: [
      {
        stack: 'Node/Spring Boot backend',
        notes: [
          'Use resolver-level instrumentation and batching utilities appropriate to the framework.',
          'Keep service-layer authorization consistent for REST and GraphQL entry points.',
        ],
      },
      {
        stack: 'PostgreSQL/Supabase database',
        notes: [
          'Use indexes for fields exposed in filters and watch for resolver patterns that create repeated queries.',
        ],
      },
    ],
  },
  {
    topic: 'Deployment',
    question: 'Describe how you would deploy a small full-stack web application to production.',
    expectedAnswerOutline: [
      'Describe environments such as local, staging, and production with separate configuration and secrets.',
      'Build and test in CI, then deploy versioned artifacts or container images.',
      'Run database migrations safely with rollback or forward-fix planning.',
      'Use health checks, logs, environment variables, and basic monitoring before sending traffic.',
      'Mention HTTPS, domain setup, backup strategy, and a simple rollback plan.',
    ],
    whyInterviewersAskThis: 'Deployment answers show whether candidates understand how code becomes a reliable product beyond their laptop.',
    commonMistakes: [
      'Hardcoding secrets or committing environment files.',
      'Manually changing production without repeatable steps.',
      'Ignoring database migrations and rollback planning.',
      'No health check or way to tell whether deploy succeeded.',
    ],
    followUpQuestions: [
      'What should happen if a migration fails?',
      'How would you roll back a bad frontend release?',
      'What configuration differs between staging and production?',
    ],
    difficulty: 'junior',
    stackSpecificVariants: [
      {
        stack: 'Docker/AWS deployment',
        notes: [
          'Use Docker images for repeatable builds and deploy to a managed service such as ECS, Elastic Beanstalk, or App Runner for a small team.',
          'Store secrets in a managed secret store or deployment platform settings, not in images.',
        ],
      },
      {
        stack: 'React/Next.js frontend',
        notes: [
          'Understand build-time versus runtime environment variables and how frontend assets are served.',
        ],
      },
    ],
  },
  {
    topic: 'Monitoring',
    question: 'What monitoring would you add after launching a new production feature?',
    expectedAnswerOutline: [
      'Define user-facing success metrics such as error rate, latency, conversion, or task completion.',
      'Collect application logs, metrics, traces where useful, and frontend error reports.',
      'Add alerts for symptoms users care about, not only CPU or memory.',
      'Create dashboards for request volume, failure rate, latency, background job failures, and key business events.',
      'Explain an incident workflow: detect, triage, mitigate, communicate, and follow up with fixes.',
    ],
    whyInterviewersAskThis: 'Monitoring assesses production maturity and whether candidates can keep features healthy after shipping.',
    commonMistakes: [
      'Only checking logs manually after users complain.',
      'Alerting on too many low-value signals and creating noise.',
      'Not instrumenting background jobs or third-party failures.',
      'Ignoring frontend errors and real user experience.',
    ],
    followUpQuestions: [
      'What alert would you create for payment failures?',
      'How would you debug a slow endpoint?',
      'What should go into a post-incident review?',
    ],
    difficulty: 'junior',
    stackSpecificVariants: [
      {
        stack: 'Docker/AWS deployment',
        notes: [
          'Centralize container logs and expose health checks for load balancers or managed services.',
          'Use managed metrics and alarms for basic infrastructure plus app-level custom metrics.',
        ],
      },
      {
        stack: 'React/Next.js frontend',
        notes: [
          'Capture client-side errors and important user journeys, especially around forms and checkout.',
        ],
      },
    ],
  },
];

export const questionBankByTopic = Object.fromEntries(
  questionBank.map((template) => [template.topic, template]),
) as Record<string, InterviewQuestionTemplate>

const DIFFICULTY_MAP: Record<InterviewDifficulty, PrepDifficulty> = {
  junior: 'beginner',
  'early-mid': 'intermediate',
  advanced: 'advanced',
}

function slugify(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** Maps a static architecture/system-design template to a unified PrepQuestion. */
export function templateToPrepQuestion(
  template: InterviewQuestionTemplate,
  priority: PrepPriority = 'resume-core',
): PrepQuestion {
  return {
    id: `arch-${slugify(template.topic)}`,
    category: 'architecture',
    difficulty: DIFFICULTY_MAP[template.difficulty],
    question: template.question,
    topic: template.topic,
    priority,
    expectedAnswer: template.expectedAnswerOutline.join('\n'),
    whyInterviewersAsk: template.whyInterviewersAskThis,
    commonMistakes: template.commonMistakes,
    followUps: template.followUpQuestions,
  }
}

/** The full architecture/system-design bank as unified PrepQuestions. */
export function architectureQuestions(): PrepQuestion[] {
  return questionBank.map((template) => templateToPrepQuestion(template))
}
