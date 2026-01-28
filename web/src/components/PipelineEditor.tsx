import React, { useMemo, useState } from 'react'
import Field from './forms/Field'

const typeUnits = {
  fixed_ms: 'ms',
  bytes: 'bytes',
  tokens: 'tokens',
}

const typeColors: Record<string, string> = {
  fixed_ms: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
  bytes: 'bg-violet-500/20 text-violet-200 border-violet-500/40',
  tokens: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
}

const presets = {
  llm: [
    { name: 'preprocess', kind: 'fixed_ms', value: 2 },
    { name: 'h2d', kind: 'bytes', value: 16 * 1024 * 1024 },
    { name: 'compute', kind: 'tokens', value: 256 },
    { name: 'd2h', kind: 'bytes', value: 4 * 1024 * 1024 },
    { name: 'postprocess', kind: 'fixed_ms', value: 1 },
  ],
  image: [
    { name: 'decode', kind: 'fixed_ms', value: 3 },
    { name: 'h2d', kind: 'bytes', value: 12 * 1024 * 1024 },
    { name: 'compute', kind: 'tokens', value: 64 },
    { name: 'd2h', kind: 'bytes', value: 3 * 1024 * 1024 },
  ],
  etl: [
    { name: 'extract', kind: 'bytes', value: 64 * 1024 * 1024 },
    { name: 'transform', kind: 'fixed_ms', value: 10 },
    { name: 'load', kind: 'bytes', value: 32 * 1024 * 1024 },
  ],
}

export default function PipelineEditor({ pipeline, setPipeline }: { pipeline: any[], setPipeline: (p: any[]) => void }) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newStage, setNewStage] = useState({ name: '', kind: 'fixed_ms', value: 1 })

  const errors = useMemo(() => pipeline.map((st) => (!st.name ? 'Name required' : st.value <= 0 ? 'Value > 0' : '')), [pipeline])

  const onDragStart = (idx: number) => setDragIndex(idx)
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === idx) return
    const next = [...pipeline]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(idx, 0, moved)
    setDragIndex(idx)
    setPipeline(next)
  }
  const onDragEnd = () => setDragIndex(null)

  const addStage = () => {
    if (!newStage.name || newStage.value <= 0) return
    setPipeline([...pipeline, newStage])
    setShowAdd(false)
    setNewStage({ name: '', kind: 'fixed_ms', value: 1 })
  }

  const update = (idx: number, key: string, val: any) => {
    const next = [...pipeline]
    next[idx] = { ...next[idx], [key]: val }
    setPipeline(next)
  }

  const duplicate = (idx: number) => {
    const next = [...pipeline]
    next.splice(idx + 1, 0, { ...pipeline[idx], name: `${pipeline[idx].name}-copy` })
    setPipeline(next)
  }

  const remove = (idx: number) => {
    const next = pipeline.filter((_, i) => i !== idx)
    setPipeline(next)
  }

  const applyPreset = (key: string) => {
    if (!presets[key]) return
    setPipeline(presets[key])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <div className="font-semibold text-slate-200">Pipeline</div>
        <div className="ml-auto flex gap-2">
          <select className="input w-40 text-xs" onChange={(e) => applyPreset(e.target.value)}>
            <option value="">Presets…</option>
            <option value="llm">LLM Inference</option>
            <option value="image">Image Inference</option>
            <option value="etl">ETL</option>
          </select>
          <button className="px-3 py-2 text-xs rounded bg-emerald-500 text-slate-950 font-semibold" onClick={() => setShowAdd(true)}>Add stage</button>
        </div>
      </div>
      <div className="text-xs text-slate-500">Order matters. Drag to reorder.</div>
      <div className="border border-slate-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[32px,1.6fr,1fr,1fr,60px,80px] bg-slate-900/80 text-xs text-slate-400 px-3 py-2 sticky top-0">
          <div />
          <div>Stage</div>
          <div>Type</div>
          <div>Value</div>
          <div>Unit</div>
          <div className="text-right pr-2">Actions</div>
        </div>
        {pipeline.map((st, idx) => (
          <div
            key={idx}
            className={`grid grid-cols-[32px,1.6fr,1fr,1fr,60px,80px] items-center px-3 py-2 border-t border-slate-800 bg-slate-900/40 ${errors[idx] ? 'border-red-600/50' : ''}`}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragOver={(e) => onDragOver(e, idx)}
            onDragEnd={onDragEnd}
          >
            <div className="cursor-grab text-slate-500">⋮⋮</div>
            <input className="input h-10" value={st.name} onChange={(e) => update(idx, 'name', e.target.value)} />
            <select className="input h-10" value={st.kind} onChange={(e) => update(idx, 'kind', e.target.value)}>
              <option value="fixed_ms">fixed_ms</option>
              <option value="bytes">bytes</option>
              <option value="tokens">tokens</option>
            </select>
            <input type="number" className="input h-10" value={st.value} onChange={(e) => update(idx, 'value', parseFloat(e.target.value))} />
            <span className={`text-center text-xs px-2 py-1 rounded border ${typeColors[st.kind] || 'border-slate-700 text-slate-300'}`}>{typeUnits[st.kind]}</span>
            <div className="flex justify-end gap-2 text-xs">
              <button className="px-2 py-1 bg-slate-700 rounded" onClick={() => duplicate(idx)}>Copy</button>
              <button className="px-2 py-1 bg-red-600 rounded" onClick={() => remove(idx)}>Del</button>
            </div>
          </div>
        ))}
      </div>
      {errors.some(Boolean) && <div className="text-xs text-red-400">Fix highlighted rows: name required and value must be &gt; 0.</div>}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-20">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 w-80 space-y-3">
            <div className="text-lg font-semibold text-slate-100">Add stage</div>
            <Field label="Name">
              <input className="input" value={newStage.name} onChange={(e) => setNewStage({ ...newStage, name: e.target.value })} />
            </Field>
            <Field label="Type">
              <select className="input" value={newStage.kind} onChange={(e) => setNewStage({ ...newStage, kind: e.target.value })}>
                <option value="fixed_ms">fixed_ms</option>
                <option value="bytes">bytes</option>
                <option value="tokens">tokens</option>
              </select>
            </Field>
            <Field label="Value">
              <input className="input" type="number" value={newStage.value} onChange={(e) => setNewStage({ ...newStage, value: parseFloat(e.target.value) })} />
            </Field>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 bg-slate-700 rounded" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="px-3 py-1 bg-emerald-500 text-slate-950 rounded" onClick={addStage}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
