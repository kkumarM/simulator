import React from 'react'
import Field from '../forms/Field'
import { inputBase, selectBase } from '../../styles/formClasses'

export default function StepTraffic({ draft, setDraft }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Arrival rate drives load; concurrency caps in-flight work.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Target RPS">
          <input type="number" className={inputBase} value={draft.rps} onChange={(e) => setDraft((d) => ({ ...d, rps: parseFloat(e.target.value) || 0 }))} />
        </Field>
        <Field label="Peak RPS (optional)">
          <input type="number" className={inputBase} value={draft.peakRps ?? ''} onChange={(e) => setDraft((d) => ({ ...d, peakRps: e.target.value === '' ? undefined : parseFloat(e.target.value) }))} />
        </Field>
        <Field label="Concurrency">
          <select className={selectBase} value={draft.concurrency} onChange={(e) => setDraft((d) => ({ ...d, concurrency: e.target.value === 'auto' ? 'auto' : parseInt(e.target.value, 10) }))}>
            <option value="auto">Auto</option>
            {[1, 2, 4, 8, 16].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Jitter / Burstiness">
          <select className={selectBase} value={draft.jitter} onChange={(e) => setDraft((d) => ({ ...d, jitter: e.target.value }))}>
            <option value="low">Low</option>
            <option value="med">Medium</option>
            <option value="high">High</option>
          </select>
        </Field>
      </div>
      <div className="text-xs text-slate-500">RPS drives arrivals; concurrency limits simultaneous compute. Higher jitter means more queueing risk.</div>
    </div>
  )
}
