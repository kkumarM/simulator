import React, { useMemo, useState } from 'react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { useWizardDraft } from '../../hooks/useWizardDraft'
import StepWorkloadType from './StepWorkloadType'
import StepTraffic from './StepTraffic'
import StepPayload from './StepPayload'
import StepCompute from './StepCompute'
import StepTargetGpu from './StepTargetGpu'
import StepReview from './StepReview'

export default function ScenarioWizard({ open, onClose, scenario, setScenario, onRun }) {
  const { draft, setDraft, reset } = useWizardDraft()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')

  const steps = [
    { title: 'Workload Type', component: StepWorkloadType },
    { title: 'Traffic & Concurrency', component: StepTraffic },
    { title: 'Payload & Transfers', component: StepPayload },
    { title: 'Compute Shape', component: StepCompute },
    { title: 'Target GPU', component: StepTargetGpu },
    { title: 'Review & Apply', component: StepReview },
  ]

  const Current = steps[step].component

  const applyDraft = (runNow?: boolean) => {
    const msg = validateDraft(draft)
    if (msg) { setError(msg); return }
    setError('')
    const next = buildScenarioFromDraft(draft, scenario)
    setScenario(next)
    if (runNow) onRun?.(next)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="text-sm uppercase tracking-[0.12em] text-slate-400">Scenario Wizard</div>
            <div className="text-lg font-semibold text-slate-100">{steps[step].title}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Step {step + 1} / {steps.length}</span>
            <button className="text-slate-400 hover:text-slate-200" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="mt-4 space-y-4 overflow-y-auto pr-1" style={{ maxHeight: '60vh' }}>
          <Current draft={draft} setDraft={setDraft} />
          {error && <div className="text-red-400 text-sm">{error}</div>}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <button className="px-3 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300" onClick={reset}>Reset wizard</button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</Button>
            {step < steps.length - 1 ? (
              <Button variant="primary" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>Next</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => applyDraft(false)}>Apply to Scenario</Button>
                <Button variant="primary" onClick={() => applyDraft(true)}>Apply & Run</Button>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

function validateDraft(d) {
  if (!d.rps || d.rps <= 0) return 'RPS must be greater than 0'
  if (d.computeMode === 'tokens' && (!d.tokens || d.tokens <= 0 || !d.msPerToken)) return 'Tokens and ms/token must be set'
  if (d.computeMode === 'fixed' && (!d.computeMs || d.computeMs <= 0)) return 'Compute ms must be set'
  if (d.inputMB < 0 || d.outputMB < 0) return 'Payload sizes must be non-negative'
  return ''
}

function buildScenarioFromDraft(draft, current) {
  const jitter_pct = draft.jitter === 'low' ? 2 : draft.jitter === 'med' ? 5 : 10
  const duration_s = current.workload?.duration_s || 10
  const base = {
    ...current,
    name: current.name || 'Wizard Scenario',
    workload: {
      ...current.workload,
      name: workloadLabel(draft.workloadType),
      rps: draft.rps,
      duration_s,
      batch_size: current.workload?.batch_size || 1,
      jitter_pct,
    },
    target: {
      ...current.target,
      name: draft.profile,
      tflops: profileTable[draft.profile]?.tflops ?? current.target?.tflops ?? 60,
      mem_gbps: profileTable[draft.profile]?.mem_gbps ?? current.target?.mem_gbps ?? 600,
      ms_per_token: draft.computeMode === 'tokens' ? draft.msPerToken : current.target?.ms_per_token ?? 0.2,
      h2d_gbps: profileTable[draft.profile]?.h2d_gbps ?? current.target?.h2d_gbps ?? 32,
      d2h_gbps: profileTable[draft.profile]?.d2h_gbps ?? current.target?.d2h_gbps ?? 32,
      concurrency: draft.concurrency === 'auto' ? (current.target?.concurrency || 2) : draft.concurrency,
    },
  }

  const pipeline = []
  const workloadDefaults = defaultsForType(draft.workloadType)
  pipeline.push({ name: 'preprocess', kind: 'fixed_ms', value: workloadDefaults.preMs })
  pipeline.push({ name: 'h2d', kind: 'bytes', value: Math.max(0, draft.inputMB * 1024 * 1024) })
  if (draft.computeMode === 'tokens') {
    pipeline.push({ name: 'compute', kind: 'tokens', value: draft.tokens })
  } else if (draft.computeMode === 'fixed') {
    pipeline.push({ name: 'compute', kind: 'fixed_ms', value: draft.computeMs })
  } else {
    // tflops mode -> convert rough TFLOP to ms using GPU tflops
    const tflops = base.target.tflops || 60
    const ms = (draft.tflopsReq / tflops) * 1000
    pipeline.push({ name: 'compute', kind: 'fixed_ms', value: Math.max(1, Math.round(ms)) })
  }
  pipeline.push({ name: 'd2h', kind: 'bytes', value: Math.max(0, draft.outputMB * 1024 * 1024) })
  pipeline.push({ name: 'postprocess', kind: 'fixed_ms', value: workloadDefaults.postMs })

  return { ...base, pipeline }
}

const profileTable = {
  A10G: { tflops: 60, mem_gbps: 600, h2d_gbps: 32, d2h_gbps: 32 },
  L4: { tflops: 30, mem_gbps: 300, h2d_gbps: 28, d2h_gbps: 28 },
  A100: { tflops: 155, mem_gbps: 1555, h2d_gbps: 80, d2h_gbps: 80 },
  H100: { tflops: 260, mem_gbps: 3000, h2d_gbps: 100, d2h_gbps: 100 },
}

function workloadLabel(t) {
  switch (t) {
    case 'llm': return 'LLM Inference'
    case 'cv': return 'CV Inference'
    case 'etl': return 'ETL Batch'
    default: return 'Custom'
  }
}

function defaultsForType(t) {
  if (t === 'cv') return { preMs: 3, postMs: 2 }
  if (t === 'etl') return { preMs: 5, postMs: 3 }
  return { preMs: 2, postMs: 1 }
}
