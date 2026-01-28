import TimelineViewer from './TimelineViewer'

export default function CompareView({ runs, compareIds, onSelect, backendUrl }) {
  const options = runs.map((r) => ({ id: r.id, label: `${r.id} • ${r.summary?.throughput_rps?.toFixed(2) ?? '?'} rps / p99 ${(r.summary?.p99_ms ?? 0).toFixed(1)} ms` }))
  const runA = runs.find((r) => r.id === compareIds[0])
  const runB = runs.find((r) => r.id === compareIds[1])

  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-2 gap-2 text-sm">
        <Select label="Run A" options={options} value={compareIds[0]} onChange={(id) => onSelect(id, compareIds[1])} />
        <Select label="Run B" options={options} value={compareIds[1]} onChange={(id) => onSelect(compareIds[0], id)} />
      </div>
      {!(runA && runB) && <div className="text-slate-400 text-sm">Select two runs to compare.</div>}
      {runA && runB && (
        <div className="space-y-2">
          <div className="text-xs text-slate-400">Legend: Sim timelines stacked; same zoom/scale.</div>
          <div className="space-y-4">
            <TimelineViewer runId={runA.id} backendUrl={backendUrl} height={300} compact />
            <TimelineViewer runId={runB.id} backendUrl={backendUrl} height={300} compact />
          </div>
        </div>
      )}
    </div>
  )
}

function Select({ label, options, value, onChange }) {
  return (
    <label className="text-xs text-slate-300 space-y-1">
      <span>{label}</span>
      <select className="input bg-slate-900/60 text-slate-100 border-slate-700 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-400/30" value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}
