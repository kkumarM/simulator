import React, { useEffect, useMemo, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import { inputBase } from '../styles/formClasses'

type SweepRun = { id: string; param: number; summary: any }

export default function Sweeps({ backendUrl, baseScenario, addRun, openRun, setActiveTab }) {
  const [rpsCfg, setRpsCfg] = useState(() => loadCfg('rps', { start: 1, end: 8, step: 1, duration: 10 }))
  const [conCfg, setConCfg] = useState(() => loadCfg('con', { start: 1, end: 8, step: 1, duration: 10 }))
  const [rpsRuns, setRpsRuns] = useState(() => loadRuns('rps'))
  const [conRuns, setConRuns] = useState(() => loadRuns('con'))
  const [running, setRunning] = useState(false)
  const [cancel, setCancel] = useState(false)
  const [tab, setTab] = useState<'rps' | 'con'>('rps')

  useEffect(() => saveCfg('rps', rpsCfg), [rpsCfg])
  useEffect(() => saveCfg('con', conCfg), [conCfg])
  useEffect(() => saveRuns('rps', rpsRuns), [rpsRuns])
  useEffect(() => saveRuns('con', conRuns), [conRuns])

  const rpsKnee = useMemo(() => findKnee(rpsRuns, 'param', 'p99'), [rpsRuns])
  const conRec = useMemo(() => recommendConcurrency(conRuns), [conRuns])

  const runSweep = async (type: 'rps' | 'con') => {
    if (running) return
    setRunning(true)
    setCancel(false)
    const cfg = type === 'rps' ? rpsCfg : conCfg
    const setRuns = type === 'rps' ? setRpsRuns : setConRuns
    const runsArr: SweepRun[] = []
    for (let v = cfg.start; v <= cfg.end; v += cfg.step) {
      if (cancel) break
      const scenario = structuredClone(baseScenario)
      scenario.workload.duration_s = cfg.duration
      if (type === 'rps') scenario.workload.rps = v
      else scenario.target.concurrency = v
      try {
        const run = await runScenario(backendUrl, scenario)
        runsArr.push({ id: run.id, param: v, summary: run.summary })
        addRun(run)
      } catch (e) {
        console.error(e)
        break
      }
      setRuns((prev) => [...prev, ...runsArr].slice(-50))
    }
    setRunning(false)
  }

  const chartDataRps = useMemo(() => toChart(rpsRuns), [rpsRuns])
  const chartDataCon = useMemo(() => toChart(conRuns), [conRuns])

  return (
    <div className="space-y-4">
      <div className="flex gap-3 text-sm">
        <button className={`px-3 py-2 rounded ${tab === 'rps' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-800 text-slate-300'}`} onClick={() => setTab('rps')}>RPS Sweep</button>
        <button className={`px-3 py-2 rounded ${tab === 'con' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-800 text-slate-300'}`} onClick={() => setTab('con')}>Concurrency Sweep</button>
      </div>

      {tab === 'rps' && (
        <Card className="p-4 space-y-3">
          <div className="grid sm:grid-cols-4 gap-3">
            <Input label="Start" value={rpsCfg.start} onChange={(v) => setRpsCfg((c) => ({ ...c, start: v }))} />
            <Input label="End" value={rpsCfg.end} onChange={(v) => setRpsCfg((c) => ({ ...c, end: v }))} />
            <Input label="Step" value={rpsCfg.step} onChange={(v) => setRpsCfg((c) => ({ ...c, step: v }))} />
            <Input label="Duration (s)" value={rpsCfg.duration} onChange={(v) => setRpsCfg((c) => ({ ...c, duration: v }))} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={() => runSweep('rps')} disabled={running}>Run sweep</Button>
            {running && <Button variant="ghost" onClick={() => setCancel(true)}>Cancel</Button>}
          </div>
          <Charts data={chartDataRps} knee={rpsKnee} label="RPS" />
          <RunTable runs={rpsRuns} onOpen={openRun} />
        </Card>
      )}

      {tab === 'con' && (
        <Card className="p-4 space-y-3">
          <div className="grid sm:grid-cols-4 gap-3">
            <Input label="Start" value={conCfg.start} onChange={(v) => setConCfg((c) => ({ ...c, start: v }))} />
            <Input label="End" value={conCfg.end} onChange={(v) => setConCfg((c) => ({ ...c, end: v }))} />
            <Input label="Step" value={conCfg.step} onChange={(v) => setConCfg((c) => ({ ...c, step: v }))} />
            <Input label="Duration (s)" value={conCfg.duration} onChange={(v) => setConCfg((c) => ({ ...c, duration: v }))} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={() => runSweep('con')} disabled={running}>Run sweep</Button>
            {running && <Button variant="ghost" onClick={() => setCancel(true)}>Cancel</Button>}
            {conRec && <span className="text-sm text-emerald-200">Recommended concurrency: {conRec}</span>}
          </div>
          <Charts data={chartDataCon} knee={null} label="Concurrency" showThroughput={false} />
          <RunTable runs={conRuns} onOpen={openRun} />
        </Card>
      )}
    </div>
  )
}

function Input({ label, value, onChange }) {
  return (
    <label className="text-sm text-slate-200 space-y-1">
      <div>{label}</div>
      <input type="number" className={inputBase} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    </label>
  )
}

function Charts({ data, knee, label, showThroughput = true }) {
  if (!data.length) return <div className="text-slate-500 text-sm">Run a sweep to see charts.</div>
  const maxP99 = Math.max(...data.map((d) => d.p99 || 0))
  const maxThr = Math.max(...data.map((d) => d.thr || 0), 1)
  const width = 520
  const height = 200
  const scaleX = (x) => (x - data[0].x) / (data[data.length - 1].x - data[0].x || 1) * (width - 40) + 20
  const scaleYp = (y) => height - 20 - (y / maxP99) * (height - 40)
  const scaleYt = (y) => height - 20 - (y / maxThr) * (height - 40)
  const p99Path = data.map((d) => `${scaleX(d.x)},${scaleYp(d.p99 || 0)}`).join(' ')
  const thrPath = data.map((d) => `${scaleX(d.x)},${scaleYt(d.thr || 0)}`).join(' ')
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <Card className="p-3">
        <div className="text-sm text-slate-200 mb-2">p99 vs {label}</div>
        <svg width="100%" height={height}>
          <polyline fill="none" stroke="#38bdf8" strokeWidth="2" points={p99Path} />
          {knee && (
            <g>
              <line x1={scaleX(knee.x)} x2={scaleX(knee.x)} y1={0} y2={height} stroke="#fbbf24" strokeDasharray="4 3" />
              <text x={scaleX(knee.x) + 4} y={20} fill="#fbbf24" fontSize="10">knee {knee.x}</text>
            </g>
          )}
          {data.map((d, i) => <circle key={i} cx={scaleX(d.x)} cy={scaleYp(d.p99 || 0)} r={3} fill="#38bdf8" />)}
        </svg>
      </Card>
      {showThroughput && (
        <Card className="p-3">
          <div className="text-sm text-slate-200 mb-2">Throughput vs {label}</div>
          <svg width="100%" height={height}>
            <polyline fill="none" stroke="#34d399" strokeWidth="2" points={thrPath} />
            {data.map((d, i) => <circle key={i} cx={scaleX(d.x)} cy={scaleYt(d.thr || 0)} r={3} fill="#34d399" />)}
          </svg>
        </Card>
      )}
    </div>
  )
}

function RunTable({ runs, onOpen }) {
  if (!runs.length) return null
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-slate-200">
        <thead>
          <tr className="text-slate-400">
            <th className="text-left py-1">Param</th>
            <th className="text-left py-1">Throughput</th>
            <th className="text-left py-1">p99 (ms)</th>
            <th className="text-left py-1">Action</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t border-slate-800">
              <td className="py-1">{r.param}</td>
              <td>{fmt(r.summary?.throughput)}</td>
              <td>{fmt(r.summary?.p99_ms || r.summary?.p99)}</td>
              <td><button className="text-emerald-300 text-xs" onClick={() => onOpen(r.id)}>Open run</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

async function runScenario(backendUrl, scenario) {
  const res = await fetch(`${backendUrl}/v1/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario }),
  })
  if (!res.ok) throw new Error('Run failed')
  const data = await res.json()
  const runId = data.run_id
  const summary = data.summary
  const breakdown = data.breakdown || (await (await fetch(`${backendUrl}/v1/runs/${runId}/breakdown`)).json())
  const tracePath = data.artifacts?.trace
  return { id: runId, summary, trace: tracePath, breakdown, scenario }
}

function toChart(runs: SweepRun[]) {
  return runs
    .filter((r) => r.summary)
    .sort((a, b) => a.param - b.param)
    .map((r) => ({ x: r.param, p99: r.summary.p99_ms || r.summary.p99, thr: r.summary.throughput }))
}

function findKnee(data: SweepRun[], xKey: string, pKey: string) {
  if (data.length < 3) return null
  const sorted = [...data].sort((a, b) => a.param - b.param)
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].summary
    const cur = sorted[i].summary
    if (!prev || !cur) continue
    const pPrev = prev.p99_ms || prev.p99 || 0
    const pCur = cur.p99_ms || cur.p99 || 0
    const tPrev = prev.throughput || 0
    const tCur = cur.throughput || 0
    if (pCur > pPrev * 1.25 && tCur < tPrev * 1.1) {
      return { x: sorted[i].param }
    }
  }
  return null
}

function recommendConcurrency(runs: SweepRun[]) {
  if (!runs.length) return null
  const sorted = [...runs].sort((a, b) => a.param - b.param)
  const minP99 = Math.min(...sorted.map((r) => (r.summary?.p99_ms || r.summary?.p99 || Infinity)))
  const good = sorted.filter((r) => (r.summary?.p99_ms || r.summary?.p99 || Infinity) <= minP99 * 1.1)
  if (!good.length) return null
  const low = good[0].param
  const high = good[good.length - 1].param
  return low === high ? `${low}` : `${low}–${high}`
}

function loadCfg(key: string, def) {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(`sweep_cfg_${key}`) : null
  if (!raw) return def
  try { return { ...def, ...JSON.parse(raw) } } catch { return def }
}
function saveCfg(key: string, val) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(`sweep_cfg_${key}`, JSON.stringify(val))
}
function loadRuns(key: string) {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(`sweep_runs_${key}`) : null
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}
function saveRuns(key: string, val) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(`sweep_runs_${key}`, JSON.stringify(val.slice(-100)))
}

function fmt(v) {
  if (v === undefined || v === null || Number.isNaN(v)) return '—'
  return typeof v === 'number' ? v.toFixed(2) : v
}
