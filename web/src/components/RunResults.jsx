import { useMemo, useState } from 'react'
import Timeline from './Timeline'
import PlaybackControls from './PlaybackControls'
import RequestDetails from './RequestDetails'
import TimelineViewer from './TimelineViewer'

export default function RunResults({ scenario, run, loading, error, compareA, compareB }) {
  const [zoom, setZoom] = useState(0.5)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [highlightActive, setHighlightActive] = useState(true)
  const active = useMemo(() => {
    if (!run?.breakdown) return { queue: 0, gpu: 0, transfer: 0 }
    let queue = 0, gpu = 0, transfer = 0
    run.breakdown.requests.forEach(req => {
      req.stages.forEach(st => {
        if (currentTime >= st.start_ms && currentTime <= st.end_ms) {
          if (st.cat === 'queue') queue++
          else if (st.cat === 'compute' || st.cat === 'gpu') gpu++
          else if (st.cat === 'h2d' || st.cat === 'd2h' || st.cat === 'mem') transfer++
        }
      })
    })
    return { queue, gpu, transfer }
  }, [run, currentTime])

  const duration = useMemo(() => {
    if (!run?.breakdown) return 0
    return Math.max(...run.breakdown.requests.map(r => r.end_ms))
  }, [run])

  if (error) return <div className="text-red-400">{error}</div>
  if (loading) return <div className="text-slate-300">Running simulation…</div>
  if (!run) return <div className="text-slate-400 text-sm">Build a scenario and hit Run to see results.</div>

  const s = run.summary || {}
  const compSummary = compareA && compareB ? diffSummary(compareA.summary, compareB.summary) : null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Run Results</h2>
          <div className="text-xs text-slate-500">Run ID: {run.id}</div>
        </div>
        {run.trace && <a className="text-emerald-400 underline text-sm" href={run.trace} target="_blank" rel="noreferrer">Download trace.json</a>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
        <Card label="Throughput (rps)" value={s.throughput_rps?.toFixed(2)} />
        <Card label="p50 latency (ms)" value={s.p50_ms?.toFixed(2)} />
        <Card label="p90 latency (ms)" value={s.p90_ms?.toFixed(2)} />
        <Card label="p99 latency (ms)" value={s.p99_ms?.toFixed(2)} />
        <Card label="Avg queue (ms)" value={s.avg_queue_ms?.toFixed(2)} />
        <Card label="Compute Busy (%)" value={s.gpu_util_percent?.toFixed(1)} tooltip="Derived from throughput vs configured concurrency; approximate GPU busy time." />
      </div>

      {compSummary && (
        <div className="bg-slate-800/60 border border-slate-700 rounded p-3 text-xs text-slate-300">
          Compare: Δ Throughput {compSummary.throughput} | Δ p99 {compSummary.p99}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <PlaybackControls duration={duration} currentTime={currentTime} setCurrentTime={setCurrentTime} playing={playing} setPlaying={setPlaying} />
          <div className="flex items-center gap-2 text-sm">
            <label className="text-slate-400">Zoom</label>
            <input type="range" min={0.1} max={2} step={0.1} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} />
          </div>
          <label className="flex items-center gap-1 text-xs text-slate-400">
            <input type="checkbox" checked={highlightActive} onChange={(e) => setHighlightActive(e.target.checked)} />
            Highlight active
          </label>
        </div>
        <div className="flex gap-4 text-xs text-slate-300">
          <span>Queued: {active.queue}</span>
          <span>GPU running: {active.gpu}</span>
          <span>Transfers: {active.transfer}</span>
        </div>
        <Timeline
          breakdown={run.breakdown}
          zoom={zoom}
          currentTime={currentTime}
          onSelectRequest={setSelectedId}
          selectedId={selectedId}
          highlightActive={highlightActive}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <RequestDetails breakdown={run.breakdown} selectedId={selectedId} />
        <StageAggregates aggregates={run.breakdown?.stage_aggregates} />
      </div>

      <div className="space-y-3">
        <div className="text-sm font-semibold text-slate-200">Trace Timeline</div>
        <TimelineViewer runId={run.id} backendUrl={''} />
      </div>

      {compareA && compareB && (
        <div className="space-y-2">
          <div className="text-sm text-slate-300 font-semibold">Compare Timelines</div>
          <div className="bg-slate-900/40 border border-slate-800 rounded p-2 space-y-3">
            <div className="text-xs text-slate-400">Run {compareA.id}</div>
            <Timeline breakdown={compareA.breakdown} zoom={zoom} currentTime={currentTime} onSelectRequest={() => {}} selectedId={null} highlightActive={false} />
            <div className="text-xs text-slate-400">Run {compareB.id}</div>
            <Timeline breakdown={compareB.breakdown} zoom={zoom} currentTime={currentTime} onSelectRequest={() => {}} selectedId={null} highlightActive={false} />
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ label, value, tooltip }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded p-3" title={tooltip}>
      <div className="text-slate-400 text-xs uppercase">{label}</div>
      <div className="text-lg font-semibold">{value ?? '—'}</div>
    </div>
  )
}

function StageAggregates({ aggregates }) {
  if (!aggregates?.length) return <div className="text-slate-400 text-sm">No stage data yet.</div>
  return (
    <div className="space-y-2 text-sm">
      <div className="font-semibold text-slate-200">Stage Breakdown</div>
      {aggregates.map((a, i) => (
        <div key={i} className="flex justify-between bg-slate-800/50 border border-slate-700 rounded px-2 py-1">
          <span className="text-slate-200">{a.name} ({a.category})</span>
          <span className="text-slate-400">avg {a.avg_ms.toFixed(2)} ms • total {a.total_ms.toFixed(1)} ms</span>
        </div>
      ))}
    </div>
  )
}

function diffSummary(a, b) {
  if (!a || !b) return null
  const d = (x, y) => `${(((x - y) / y) * 100).toFixed(1)}%`
  return {
    throughput: d(a.throughput_rps, b.throughput_rps),
    p99: d(-(a.p99_ms), -(b.p99_ms)), // negative to show decrease as positive
  }
}
