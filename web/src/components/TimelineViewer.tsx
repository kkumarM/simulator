import React, { useEffect, useMemo, useRef, useState } from 'react'
import { parseTraceToSpans, Span } from '../utils/trace'

type Props = {
  runId: string
  backendUrl: string
}

const laneColor: Record<string, string> = {
  queue: '#fbbf24',
  cpu: '#60a5fa',
  h2d: '#a855f7',
  d2h: '#ec4899',
  gpu: '#22d3ee',
}

export default function TimelineViewer({ runId, backendUrl }: Props) {
  const [spans, setSpans] = useState<Span[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [zoom, setZoom] = useState(0.4) // px per ms
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [selected, setSelected] = useState<Span | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const rafRef = useRef<number>()

  const endTime = useMemo(() => spans.reduce((m, s) => Math.max(m, s.endMs), 0), [spans])
  const lanes = useMemo(() => {
    const map: Record<string, Span[]> = {}
    spans.forEach((s) => {
      const lane = s.lane || 'lane'
      if (!map[lane]) map[lane] = []
      map[lane].push(s)
    })
    return map
  }, [spans])

  useEffect(() => {
    if (!runId) return
    setLoading(true)
    setError('')
    fetch(`${backendUrl}/v1/runs/${runId}/trace`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch trace')
        return r.json()
      })
      .then((json) => {
        const parsed = parseTraceToSpans(json)
        setSpans(parsed)
        setCurrent(0)
        setSelected(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [runId, backendUrl])

  useEffect(() => {
    if (!playing) return
    const tick = () => {
      setCurrent((c) => {
        const next = c + 16 * speed
        if (next >= endTime) {
          setPlaying(false)
          return endTime
        }
        return next
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => rafRef.current && cancelAnimationFrame(rafRef.current)
  }, [playing, speed, endTime])

  const active = useMemo(() => {
    const byLane: Record<string, number> = {}
    let total = 0
    spans.forEach((s) => {
      if (current >= s.startMs && current <= s.endMs) {
        total++
        byLane[s.lane] = (byLane[s.lane] || 0) + 1
      }
    })
    const queued = byLane['queue'] || 0
    const gpu = byLane['gpu'] || 0
    const transfer = (byLane['h2d'] || 0) + (byLane['d2h'] || 0) + (byLane['mem'] || 0)
    const cpu = byLane['cpu'] || 0
    return { total, byLane, queued, gpu, transfer, cpu }
  }, [spans, current])

  const gpuSaturated = useMemo(() => {
    if (!spans.length) return false
    const window = 500 // ms
    const start = Math.max(0, current - window)
    const end = current
    const gpuSpans = spans.filter((s) => s.lane === 'gpu')
    if (!gpuSpans.length || end <= start) return false
    let covered = 0
    gpuSpans.forEach((s) => {
      const overlap = Math.min(end, s.endMs) - Math.max(start, s.startMs)
      if (overlap > 0) covered += overlap
    })
    const utilization = covered / (end - start)
    return utilization >= 0.8
  }, [spans, current])

  if (!runId) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm">
        <button className="px-3 py-1 rounded bg-emerald-500 text-slate-950 font-semibold" onClick={() => setPlaying((p) => !p)}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <input type="range" min={0} max={endTime || 1} value={current} onChange={(e) => { setCurrent(parseFloat(e.target.value)); setPlaying(false) }} className="w-full" />
        <select className="input w-24" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))}>
          {[0.5, 1, 2, 4].map(s => <option key={s} value={s}>{s}x</option>)}
        </select>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span>Active: {active.total}</span>
          <span>Queued: {active.queued}</span>
          <span>GPU: {active.gpu}</span>
          <span>Transfer: {active.transfer}</span>
          <span>CPU: {active.cpu}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <label className="text-slate-400">Zoom</label>
        <input type="range" min={0.1} max={2} step={0.1} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} />
      </div>

      {loading && <div className="h-40 bg-slate-800/40 rounded animate-pulse" />}
      {error && <div className="text-red-400 text-sm">{error} — you can still download the trace.</div>}

      {!loading && spans.length > 0 && (
        <div className="flex gap-4">
          <div className="flex-1 overflow-x-auto border border-slate-800 rounded bg-slate-900/60" style={{ position: 'relative' }}>
            <Ruler end={endTime} zoom={zoom} />
            {Object.entries(lanes).map(([lane, list]) => (
              <LaneRow key={lane} label={lane.toUpperCase()} spans={list} zoom={zoom} current={current} onSelect={setSelected} selected={selected} />
            ))}
            <GridOverlay end={endTime} zoom={zoom} />
            {gpuSaturated && <div className="absolute top-2 right-2 text-xs bg-amber-500 text-slate-900 px-2 py-1 rounded">GPU saturated</div>}
            {active.queued > 0 && <div className="absolute top-2 right-32 text-xs bg-indigo-400 text-slate-900 px-2 py-1 rounded">Queue forming</div>}
          </div>
          <Details span={selected} />
        </div>
      )}
      <HelpPanel open={showHelp} toggle={() => setShowHelp((p) => !p)} />
    </div>
  )
}

function LaneRow({ label, spans, zoom, current, onSelect, selected }: { label: string, spans: Span[], zoom: number, current: number, onSelect: (s: Span) => void, selected: Span | null }) {
  const maxEnd = spans.reduce((m, s) => Math.max(m, s.endMs), 0)
  const width = Math.max(maxEnd * zoom + 200, 600)
  return (
    <div className="relative border-t border-slate-800" style={{ height: 40 }}>
      <div className="sticky left-0 top-0 w-20 h-full flex items-center justify-center text-xs text-slate-400 bg-slate-900/90 backdrop-blur border-r border-slate-800 z-10">{label}</div>
      <div className="absolute left-20 right-0 top-0 h-full" style={{ width }}>
        {spans.map((s, i) => {
          const left = s.startMs * zoom
          const widthPx = Math.max(2, s.durMs * zoom)
          const active = current >= s.startMs && current <= s.endMs
          const color = laneColor[s.lane] || '#22d3ee'
          return (
            <div
              key={i}
              className="absolute h-6 rounded text-[10px] px-1 overflow-hidden whitespace-nowrap cursor-pointer"
              style={{ left, width: widthPx, top: 8, background: color, opacity: active ? 1 : 0.35, border: selected === s ? '2px solid white' : '1px solid rgba(0,0,0,0.3)' }}
              title={`${s.name} (${s.lane}) ${s.durMs.toFixed(2)} ms`}
              onClick={() => onSelect(s)}
            >
              {s.name}
            </div>
          )
        })}
        <div className="absolute inset-y-0" style={{ left: current * zoom, width: 2, background: '#f87171' }}></div>
      </div>
    </div>
  )
}

function Ruler({ end, zoom }: { end: number, zoom: number }) {
  const ticks = []
  const step = chooseStep(end)
  for (let t = 0; t <= end; t += step) {
    ticks.push(t)
  }
  return (
    <div className="relative h-8 border-b border-slate-800">
      {ticks.map((t) => (
        <div key={t} className="absolute top-0 text-[10px] text-slate-500" style={{ left: t * zoom }}>
          <div className="w-px h-4 bg-slate-700" />
          <div className="mt-1">{t.toFixed(0)}ms</div>
        </div>
      ))}
    </div>
  )
}

function chooseStep(end: number) {
  if (end < 100) return 10
  if (end < 500) return 50
  if (end < 2000) return 100
  return 500
}

function Details({ span }: { span: Span | null }) {
  if (!span) return <div className="w-64 text-slate-400 text-sm">Click a span to see details.</div>
  return (
    <div className="w-64 bg-slate-900/60 border border-slate-800 rounded p-3 text-sm space-y-1">
      <div className="font-semibold text-slate-200">{span.name}</div>
      <div className="text-slate-400 text-xs">Lane: {span.lane}</div>
      <div>Start: {span.startMs.toFixed(2)} ms</div>
      <div>End: {span.endMs.toFixed(2)} ms</div>
      <div>Duration: {span.durMs.toFixed(2)} ms</div>
      {span.cat && <div>Cat: {span.cat}</div>}
      {span.tid !== undefined && <div>tid: {span.tid}</div>}
      {span.pid !== undefined && <div>pid: {span.pid}</div>}
    </div>
  )
}

function GridOverlay({ end, zoom }: { end: number, zoom: number }) {
  const step = chooseStep(end)
  const width = Math.max(end * zoom + 200, 600)
  const bg = `repeating-linear-gradient(to right, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 1px, transparent ${step * zoom}px)`
  return <div className="pointer-events-none absolute inset-0" style={{ width, backgroundImage: bg }} />
}

function HelpPanel({ open, toggle }: { open: boolean, toggle: () => void }) {
  return (
    <div className="border border-slate-800 rounded bg-slate-900/70">
      <button className="w-full text-left px-3 py-2 text-sm text-slate-200 flex justify-between" onClick={toggle}>
        <span>How to read this timeline</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-xs text-slate-300 space-y-2">
          <div>Lanes: QUEUE (waiting), CPU (pre/post), H2D/D2H (transfers), GPU (compute). Colored bars show when each stage ran.</div>
          <div>Each bar = one span for a request stage. Overlap means stages ran in parallel (different requests or different resources).</div>
          <div>Red time cursor shows current playback position. Active spans are bright; inactive are dimmed.</div>
        </div>
      )}
    </div>
  )
}
