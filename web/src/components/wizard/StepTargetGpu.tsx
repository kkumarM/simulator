import React from 'react'
import Field from '../forms/Field'
import { selectBase } from '../../styles/formClasses'

export default function StepTargetGpu({ draft, setDraft }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Pick a target GPU profile; you can adjust later.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="GPU Profile">
          <select className={selectBase} value={draft.profile} onChange={(e) => setDraft((d) => ({ ...d, profile: e.target.value }))}>
            {['A10G', 'L4', 'A100', 'H100', 'Custom'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Overlap toggles (UI hint only)">
          <div className="flex gap-3 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.overlapCpu} onChange={(e) => setDraft((d) => ({ ...d, overlapCpu: e.target.checked }))} />
              CPU overlap
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.overlapTransfer} onChange={(e) => setDraft((d) => ({ ...d, overlapTransfer: e.target.checked }))} />
              H2D/D2H overlap
            </label>
          </div>
        </Field>
      </div>
      <div className="text-xs text-slate-500">Overlap toggles are hints for your mental model; current sim uses queueing + concurrency for compute.</div>
    </div>
  )
}
