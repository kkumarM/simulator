import { useEffect, useState } from 'react'

export type WizardDraft = {
  workloadType: 'llm' | 'cv' | 'etl' | 'custom'
  rps: number
  peakRps?: number
  concurrency: number | 'auto'
  jitter: 'low' | 'med' | 'high'
  duration: number
  inputMB: number
  outputMB: number
  computeMode: 'tokens' | 'fixed' | 'tflops'
  tokens: number
  msPerToken: number
  computeMs: number
  tflopsReq: number
  profile: string
  overlapCpu: boolean
  overlapTransfer: boolean
}

const defaultDraft: WizardDraft = {
  workloadType: 'llm',
  rps: 2,
  peakRps: 3,
  concurrency: 2,
  jitter: 'med',
  duration: 10,
  inputMB: 8,
  outputMB: 2,
  computeMode: 'tokens',
  tokens: 128,
  msPerToken: 0.2,
  computeMs: 15,
  tflopsReq: 0.5,
  profile: 'A10G',
  overlapCpu: true,
  overlapTransfer: false,
}

export function useWizardDraft() {
  const [draft, setDraft] = useState<WizardDraft>(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('aurix_wizard') : null
    if (stored) {
      try { return { ...defaultDraft, ...JSON.parse(stored) } } catch { /* ignore */ }
    }
    return defaultDraft
  })

  useEffect(() => {
    localStorage.setItem('aurix_wizard', JSON.stringify(draft))
  }, [draft])

  const reset = () => setDraft(defaultDraft)

  return { draft, setDraft, reset }
}
