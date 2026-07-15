import { Construction } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

interface PlaceholderPageProps {
  title: string
  description: string
}

/** Stand-in for modules on the roadmap that aren't built yet. */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return <EmptyState icon={Construction} title={title} description={description} />
}
