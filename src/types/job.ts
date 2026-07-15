export type WorkMode = 'remote' | 'hybrid' | 'onsite' | 'unknown'

export interface JobOpportunity {
  id: string
  company: string
  role: string
  /** The pasted job description — primary input to the analyzer. */
  description: string
  url?: string
  category?: string
  salaryRange?: string
  location?: string
  workMode: WorkMode
  tags: string[]
  createdAt: string
  archived: boolean
}
