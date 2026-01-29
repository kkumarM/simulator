import React from 'react'
import Card from '../ui/Card'

export default function StepWorkloadType({ draft, setDraft }) {
  const options = [
    { id: 'llm', label: 'LLM Inference', desc: 'Chat, completion, token-based workloads', defaults: { inputMB: 8, outputMB: 2, tokens: 128, msPerToken: 0.2 } },
    { id: 'cv', label: 'CV Inference', desc: 'Image/video classification or detection', defaults: { inputMB: 1, outputMB: 0.064, computeMs: 15, computeMode: 'fixed' } },
    { id: 'etl', label: 'ETL / Batch', desc: 'Data prep or batch transforms', defaults: { inputMB: 12, outputMB: 2, computeMs: 25, computeMode: 'fixed' } },
    { id: 'custom', label: 'Custom', desc: 'Start blank and fill manually', defaults: {} },
  ]

  const choose = (opt) => {
    setDraft((d) => ({ ...d, workloadType: opt.id, ...opt.defaults }))
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Pick the workload style that matches your app; we’ll seed sensible defaults.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {options.map((opt) => (
          <Card key={opt.id} className={`p-3 cursor-pointer border ${draft.workloadType === opt.id ? 'border-emerald-500/60' : 'border-slate-800'}`} onClick={() => choose(opt)}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-slate-100 font-semibold">{opt.label}</div>
                <div className="text-xs text-slate-500">{opt.desc}</div>
              </div>
              <div className={`h-3 w-3 rounded-full ${draft.workloadType === opt.id ? 'bg-emerald-400' : 'bg-slate-700'}`} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
