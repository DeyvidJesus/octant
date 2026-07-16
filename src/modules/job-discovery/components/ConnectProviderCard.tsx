import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

/** Shown by any discovery panel when no AI provider is configured. */
export function ConnectProviderCard({ description }: { description: string }) {
  return (
    <Card className="text-center py-12">
      <Sparkles size={28} className="text-edge-2 mx-auto mb-4" aria-hidden />
      <h3 className="text-white font-medium mb-2">Connect an AI provider</h3>
      <p className="text-sm text-muted max-w-md mx-auto mb-6 leading-relaxed">{description}</p>
      <Link to="/settings">
        <Button variant="subtle">Configure in Settings</Button>
      </Link>
    </Card>
  )
}
