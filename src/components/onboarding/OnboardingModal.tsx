import { useState } from 'react'
import { Rocket, FileText, Brain, Search, Briefcase, CheckCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useSettingsStore } from '@/stores/settingsStore'

const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to CareerOS',
    description: 'Your local-first command center for navigating your career, tracking applications, and preparing for interviews.',
    icon: Rocket,
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
  },
  {
    id: 'resume',
    title: 'Master Resume',
    description: 'Add your entire work history, skills, and projects here. We use this to tailor resumes and match you to jobs.',
    icon: FileText,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
  },
  {
    id: 'knowledge',
    title: 'Knowledge Base',
    description: 'Log your STAR stories, technical decisions, and performance metrics. These help the AI coach you for interviews.',
    icon: Brain,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
  },
  {
    id: 'discovery',
    title: 'Job Discovery',
    description: 'Paste job links or run deep research to import opportunities. AI will score them against your Master Resume.',
    icon: Search,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  {
    id: 'tracking',
    title: 'Track & Prepare',
    description: 'Track your applications in the pipeline, generate tailored resumes, and use the AI coach to practice interview questions.',
    icon: Briefcase,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
  }
]

export function OnboardingModal() {
  const onboardingCompleted = useSettingsStore((state) => state.onboardingCompleted)
  const completeOnboarding = useSettingsStore((state) => state.completeOnboarding)
  const [step, setStep] = useState(0)

  if (onboardingCompleted) return null

  const currentStep = ONBOARDING_STEPS[step]
  const isLastStep = step === ONBOARDING_STEPS.length - 1

  const handleNext = () => {
    if (isLastStep) {
      completeOnboarding()
    } else {
      setStep((s) => s + 1)
    }
  }

  const handleSkip = () => {
    completeOnboarding()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-lg relative animate-rise-in">
        <Card className="border-edge-2 shadow-2xl p-0 overflow-hidden bg-base">
          <div className="p-8 text-center flex flex-col items-center">
            <div className={`p-4 rounded-2xl mb-6 ${currentStep.bg}`}>
              <currentStep.icon size={48} className={currentStep.color} strokeWidth={1.5} />
            </div>
            
            <h2 className="text-2xl font-semibold text-white mb-3">
              {currentStep.title}
            </h2>
            
            <p className="text-ink-2 mb-8 leading-relaxed text-center max-w-md">
              {currentStep.description}
            </p>

            <div className="flex items-center gap-2 mb-8">
              {ONBOARDING_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? 'w-6 bg-emerald-400' : 'w-1.5 bg-edge-2'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3 w-full">
              {!isLastStep && (
                <Button variant="ghost" className="flex-1" onClick={handleSkip}>
                  Skip tour
                </Button>
              )}
              <Button className={isLastStep ? 'w-full' : 'flex-1'} onClick={handleNext}>
                {isLastStep ? (
                  <>
                    <CheckCircle size={16} /> Get Started
                  </>
                ) : (
                  'Next'
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
