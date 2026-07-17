import {
  LayoutDashboard,
  Database,
  Briefcase,
  FileText,
  KanbanSquare,
  MessageSquare,
  BookOpen,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavEntry {
  label: string
  path: string
  icon: LucideIcon
  /** Modules not yet built render a placeholder page. */
  planned?: boolean
}

export const NAV_ENTRIES: NavEntry[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Master Resume', path: '/resume', icon: Database },
  { label: 'Opportunities', path: '/jobs', icon: Briefcase },
  { label: 'Applications', path: '/applications', icon: KanbanSquare },
  { label: 'Resume Generator', path: '/generator', icon: FileText },
  { label: 'Interview Prep', path: '/interviews', icon: MessageSquare },
  { label: 'Knowledge Base', path: '/knowledge', icon: BookOpen },
  { label: 'Career Metrics', path: '/metrics', icon: BarChart3 },
  { label: 'Settings', path: '/settings', icon: Settings },
]
