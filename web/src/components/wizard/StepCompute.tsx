import React from 'react'
import Field from '../forms/Field'
import { inputBase, selectBase } from '../../styles/formClasses'

export default function StepCompute({ draft, setDraft }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Pick a compute model; we’ll build the compute stage accordingly.</p>
      <div className="grid sm:grid-cols-3 gap-2">
        {['tokens', 'fixed', 'tflops'].map((mode) => (
          <button
            key={mode}
            className={`px-3 py-2 rounded border text-sm ${draft.computeMode === mode ? 'border-emerald-500/60 text-emerald-200' : 'border-slate-800 text-slate-300'}`}
            onClick={() => setDraft((d) => ({ ...d, computeMode: mode }))}
          >
            {label(mode)}
          </button>
        ))}
      </div>

      {draft.computeMode === 'tokens' && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Tokens per request">
            <input type="number" className={inputBase} value={draft.tokens} onChange={(e) => setDraft((d) => ({ ...d, tokens: parseInt(e.target.value, 10) || 0 }))} />
          </Field>
          <Field label="ms per token">
            <input type="number" className={inputBase} value={draft.msPerToken} onChange={(e) => setDraft((d) => ({ ...d, msPerToken: parseFloat(e.target.value) || 0 }))} />
          </Field>
        </div>
      )}

      {draft.computeMode === 'fixed' && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Compute time (ms)">
            <input type="number" className={inputBase} value={draft.computeMs} onChange={(e) => setDraft((d) => ({ ...d, computeMs: parseFloat(e.target.value) || 0 }))} />
          </Field>
        </div>
      )}

      {draft.computeMode === 'tflops' && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Approx TFLOP per request">
            <input type="number" className={inputBase} value={draft.tflopsReq} onChange={(e) => setDraft((d) => ({ ...d, tflopsReq: parseFloat(e.target.value) || 0 }))} />
          </Field>
          <Field label="Assume profile">
            <select className={selectBase} value={draft.profile} onChange={(e) => setDraft((d) => ({ ...d, profile: e.target.value }))}>
              {['A10G', 'L4', 'A100', 'H100'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>
      )}
    </div>
  )
}

function label(mode) {
  if (mode === 'tokens') return 'Tokens (LLM)'
  if (mode === 'fixed') return 'Fixed ms'
  return 'TFLOP est.'
}
