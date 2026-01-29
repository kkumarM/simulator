import React, { useMemo } from 'react'
import Field from '../forms/Field'
import { inputBase } from '../../styles/formClasses'

export default function StepPayload({ draft, setDraft }) {
  const transferMb = useMemo(() => {
    return { h2d: draft.inputMB, d2h: draft.outputMB }
  }, [draft.inputMB, draft.outputMB])

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Estimate per-request payload sizes to size transfers.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Input size (MB)">
          <input type="number" className={inputBase} value={draft.inputMB} onChange={(e) => setDraft((d) => ({ ...d, inputMB: parseFloat(e.target.value) || 0 }))} />
        </Field>
        <Field label="Output size (MB)">
          <input type="number" className={inputBase} value={draft.outputMB} onChange={(e) => setDraft((d) => ({ ...d, outputMB: parseFloat(e.target.value) || 0 }))} />
        </Field>
      </div>
      <div className="text-xs text-slate-400">
        Estimated transfer per request: <span className="text-slate-200">{transferMb.h2d.toFixed(2)} MB H2D</span> /
        <span className="text-slate-200"> {transferMb.d2h.toFixed(2)} MB D2H</span>
      </div>
    </div>
  )
}
