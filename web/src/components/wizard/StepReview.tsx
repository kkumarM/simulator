import React, { useMemo } from 'react'
import Card from '../ui/Card'

export default function StepReview({ draft }) {
  const summary = useMemo(() => {
    const pre = defaultsForType(draft.workloadType).preMs
    const post = defaultsForType(draft.workloadType).postMs
    const h2d = draft.inputMB * 1024 * 1024
    const d2h = draft.outputMB * 1024 * 1024
    const compute =
      draft.computeMode === 'tokens'
        ? `${draft.tokens} tokens @ ${draft.msPerToken} ms/token`
        : draft.computeMode === 'fixed'
          ? `${draft.computeMs} ms fixed`
          : `${draft.tflopsReq} TFLOP est.`
    return { pre, post, h2d, d2h, compute }
  }, [draft])

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Review the scenario that will be applied to the builder.</p>
      <Card className="p-4 space-y-2">
        <div className="text-slate-100 font-semibold">Workload</div>
        <div className="text-sm text-slate-300">Type: {label(draft.workloadType)} · RPS {draft.rps} · Concurrency {draft.concurrency === 'auto' ? 'auto' : draft.concurrency} · Jitter {draft.jitter}</div>
        <div className="text-slate-100 font-semibold pt-2">Pipeline</div>
        <ul className="text-sm text-slate-300 space-y-1">
          <li>preprocess: {summary.pre} ms</li>
          <li>h2d: {toMB(summary.h2d)} MB</li>
          <li>compute: {summary.compute}</li>
          <li>d2h: {toMB(summary.d2h)} MB</li>
          <li>postprocess: {summary.post} ms</li>
        </ul>
        <div className="text-slate-100 font-semibold pt-2">GPU</div>
        <div className="text-sm text-slate-300">Profile: {draft.profile}</div>
      </Card>
      <div className="text-xs text-slate-500">You can still tweak fields after applying.</div>
    </div>
  )
}

function label(t) {
  if (t === 'llm') return 'LLM Inference'
  if (t === 'cv') return 'CV Inference'
  if (t === 'etl') return 'ETL / Batch'
  return 'Custom'
}

function defaultsForType(t) {
  if (t === 'cv') return { preMs: 3, postMs: 2 }
  if (t === 'etl') return { preMs: 5, postMs: 3 }
  return { preMs: 2, postMs: 1 }
}

function toMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2)
}
