import React, { useEffect, useState } from 'react'
import { loadScenario } from '../utils/scenarioStore'

function diffPipeline(current: any[], other: any[]) {
  const max = Math.max(current.length, other.length)
  const rows = []
  for (let i = 0; i < max; i++) {
    const a = current[i]
    const b = other[i]
    const status = !a && b ? 'added' : a && !b ? 'removed' : a && b && (a.name !== b.name || a.kind !== b.kind || a.value !== b.value) ? 'changed' : 'same'
    rows.push({ a, b, status })
  }
  return rows
}

// exported for tests
export const diffPipelineForTest = diffPipeline

function fieldDiff(a: any, b: any, key: string) {
  if (a?.[key] === b?.[key]) return 'same'
  return 'changed'
}

export default function ScenarioDiffModal({ open, onClose, current, savedList, onApply }) {
  const [selected, setSelected] = useState('')
  const [other, setOther] = useState<any | null>(null)

  useEffect(() => {
    if (open) setSelected('')
  }, [open])

  useEffect(() => {
    if (selected) {
      const sc = loadScenario(selected)
      setOther(sc)
    }
  }, [selected])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-30 flex items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 w-[720px] max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold text-slate-100">Scenario Diff</div>
          <button className="text-slate-400" onClick={onClose}>✕</button>
        </div>
        <div className="flex items-center gap-2 mb-3 text-sm">
          <span className="text-slate-300">Compare current with:</span>
          <select className="input h-9 bg-slate-900/60 text-slate-100 border-slate-700 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-400/30" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Choose saved scenario</option>
            {savedList.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({new Date(s.updated).toLocaleString()})</option>
            ))}
          </select>
          {other && <button className="px-3 py-1 bg-emerald-500 text-slate-950 rounded" onClick={() => onApply(other)}>Apply selected</button>}
        </div>
        {!other && <div className="text-slate-400 text-sm">Select a saved scenario to view diff.</div>}
        {other && (
          <div className="space-y-4 text-sm">
            <Section title="Workload" rows={[
              ['RPS', current.workload.rps, other.workload.rps, fieldDiff(current.workload, other.workload, 'rps')],
              ['Duration', current.workload.duration_s, other.workload.duration_s, fieldDiff(current.workload, other.workload, 'duration_s')],
              ['Batch', current.workload.batch_size, other.workload.batch_size, fieldDiff(current.workload, other.workload, 'batch_size')],
              ['Concurrency', current.target.concurrency, other.target.concurrency, fieldDiff(current.target, other.target, 'concurrency')],
              ['Jitter %', current.workload.jitter_pct, other.workload.jitter_pct, fieldDiff(current.workload, other.workload, 'jitter_pct')],
            ]} />
            <Section title="Target GPU" rows={[
              ['Profile', current.target.name, other.target.name, fieldDiff(current.target, other.target, 'name')],
              ['TFLOPS', current.target.tflops, other.target.tflops, fieldDiff(current.target, other.target, 'tflops')],
              ['Mem GB/s', current.target.mem_gbps, other.target.mem_gbps, fieldDiff(current.target, other.target, 'mem_gbps')],
              ['H2D GB/s', current.target.h2d_gbps, other.target.h2d_gbps, fieldDiff(current.target, other.target, 'h2d_gbps')],
              ['D2H GB/s', current.target.d2h_gbps, other.target.d2h_gbps, fieldDiff(current.target, other.target, 'd2h_gbps')],
              ['ms/token', current.target.ms_per_token, other.target.ms_per_token, fieldDiff(current.target, other.target, 'ms_per_token')],
            ]} />
            <div className="space-y-2">
              <div className="text-slate-200 font-semibold">Pipeline</div>
              <div className="text-xs text-slate-500">Added (green), removed (red), changed (yellow)</div>
              <div className="border border-slate-800 rounded">
                {diffPipeline(current.pipeline, other.pipeline).map((row, idx) => (
                  <div key={idx} className={`grid grid-cols-2 text-xs border-b border-slate-800 last:border-0 ${row.status === 'added' ? 'bg-emerald-500/10' : row.status === 'removed' ? 'bg-red-500/10' : row.status === 'changed' ? 'bg-amber-500/10' : ''}`}>
                    <div className="px-2 py-1 text-slate-200">{row.a ? `${row.a.name} (${row.a.kind}) ${row.a.value}` : <s className="text-red-300">missing</s>}</div>
                    <div className="px-2 py-1 text-slate-200">{row.b ? `${row.b.name} (${row.b.kind}) ${row.b.value}` : <s className="text-red-300">missing</s>}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, rows }) {
  return (
    <div className="space-y-1">
      <div className="text-slate-200 font-semibold">{title}</div>
      <div className="border border-slate-800 rounded">
        {rows.map(([label, a, b, status], i) => (
          <div key={i} className={`grid grid-cols-3 text-xs border-b border-slate-800 last:border-0 ${status === 'changed' ? 'bg-amber-500/10' : ''}`}>
            <div className="px-2 py-1 text-slate-400">{label}</div>
            <div className="px-2 py-1 text-slate-200">{a ?? '—'}</div>
            <div className="px-2 py-1 text-slate-200">{b ?? '—'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
