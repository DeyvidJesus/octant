import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Rocket, Sparkles, Loader2, CheckCircle, PenLine } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useSettingsStore, resolveAiRunConfig } from '@/stores/settingsStore'
import { useResumeStore } from '@/stores/resumeStore'
import { extractProfile, type ExtractProfileResult } from '@/services/ai/tasks/extractProfile'

type Step = 'welcome' | 'import' | 'done'

export function OnboardingModal() {
  const onboardingCompleted = useSettingsStore((state) => state.onboardingCompleted)
  const completeOnboarding = useSettingsStore((state) => state.completeOnboarding)
  const updateKnowledgeBase = useResumeStore((state) => state.updateKnowledgeBase)
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('welcome')
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<'idle' | 'extracting'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExtractProfileResult['counts'] | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Move focus into the dialog on open (basic a11y; full focus-trap is a later pass).
  useEffect(() => {
    if (!onboardingCompleted) dialogRef.current?.focus()
  }, [onboardingCompleted])

  // Escape dismisses the tour (same as "I'll do this later").
  useEffect(() => {
    if (onboardingCompleted) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'extracting') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish is stable enough for this modal
  }, [onboardingCompleted, phase])

  if (onboardingCompleted) return null

  function finish(destination?: string) {
    completeOnboarding()
    if (destination) navigate(destination)
  }

  const runExtraction = async () => {
    const config = resolveAiRunConfig()
    setPhase('extracting')
    setError(null)
    try {
      const extracted = await extractProfile(text, config)
      updateKnowledgeBase(extracted.knowledgeBase)
      setResult(extracted.counts)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import your résumé. Try again, or add it manually.')
    } finally {
      setPhase('idle')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
        className="w-full max-w-lg relative animate-rise-in outline-none"
      >
        <Card className="border-edge-2 shadow-2xl p-0 overflow-hidden bg-base">
          <div className="p-8">
            {step === 'welcome' && (
              <div className="text-center flex flex-col items-center">
                <div className="p-4 rounded-2xl mb-6 bg-indigo-400/10">
                  <Rocket size={44} className="text-indigo-400" strokeWidth={1.5} />
                </div>
                <h2 id="onboarding-title" className="text-2xl font-semibold text-white mb-3">
                  Welcome to CareerOS
                </h2>
                <p className="text-ink-2 mb-8 leading-relaxed max-w-md">
                  Your command center for tracking applications, tailoring resumes, and preparing for
                  interviews. First, let's build your Knowledge Base — everything else is powered by it.
                </p>
                <div className="flex items-center gap-3 w-full">
                  <Button variant="ghost" className="flex-1" onClick={() => finish('/knowledge')}>
                    I'll do this later
                  </Button>
                  <Button className="flex-1" onClick={() => setStep('import')}>
                    Get started
                  </Button>
                </div>
              </div>
            )}

            {step === 'import' && (
              <div>
                <h2 id="onboarding-title" className="text-xl font-semibold text-white mb-2">
                  Import your résumé
                </h2>
                <p className="text-sm text-ink-2 mb-4 leading-relaxed">
                  Paste your résumé text and we'll extract your roles, skills, and achievements into your
                  Knowledge Base for you to review. Nothing is shared — it stays in your account.
                </p>
                <label htmlFor="resume-text" className="sr-only">
                  Résumé text
                </label>
                <textarea
                  id="resume-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={phase === 'extracting'}
                  rows={9}
                  placeholder="Paste the full text of your résumé here…"
                  className="w-full rounded-lg bg-surface border border-edge px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-edge-3 focus:outline-none resize-none disabled:opacity-50"
                />

                {error && (
                  <p className="text-sm text-red-400 mt-3" role="alert">
                    {error}
                  </p>
                )}

                <div className="flex items-center gap-3 w-full mt-5">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => finish('/knowledge')}
                    disabled={phase === 'extracting'}
                  >
                    <PenLine size={16} aria-hidden /> Add manually
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={runExtraction}
                    disabled={phase === 'extracting' || text.trim().length === 0}
                  >
                    {phase === 'extracting' ? (
                      <>
                        <Loader2 size={16} className="animate-spin" aria-hidden /> Importing…
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} aria-hidden /> Import with AI
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {step === 'done' && result && (
              <div className="text-center flex flex-col items-center">
                <div className="p-4 rounded-2xl mb-6 bg-emerald-400/10">
                  <CheckCircle size={44} className="text-emerald-400" strokeWidth={1.5} />
                </div>
                <h2 id="onboarding-title" className="text-2xl font-semibold text-white mb-3">
                  Knowledge Base imported
                </h2>
                <p className="text-ink-2 mb-8 leading-relaxed max-w-md">
                  Added {result.roles} role{result.roles === 1 ? '' : 's'}, {result.skills} skill
                  {result.skills === 1 ? '' : 's'}, {result.facts} achievement{result.facts === 1 ? '' : 's'} and{' '}
                  {result.credentials} credential{result.credentials === 1 ? '' : 's'}. They're marked "needs review" —
                  confirm and refine them in your Knowledge Base.
                </p>
                <Button className="w-full" onClick={() => finish('/knowledge')}>
                  Review my Knowledge Base
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
