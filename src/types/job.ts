export type WorkMode = 'remote' | 'hybrid' | 'onsite' | 'unknown'

/** How a job entered the board: hand-entered, imported from a pasted report, or found by a sweep. */
export type JobSource = 'manual' | 'imported' | 'discovered'

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
  source: JobSource
}
