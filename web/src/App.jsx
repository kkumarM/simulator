import { useEffect, useRef, useState } from 'react'
import ScenarioPanel from './components/ScenarioPanel'
import RunResults from './components/RunResults'
import RunHistory from './components/RunHistory'
import TimelineViewer from './components/TimelineViewer'
import TimelineControls from './components/TimelineControls'
import CompareView from './components/CompareView'
import Tabs from './components/Tabs'
import RequestDetails from './components/RequestDetails'
import StageAggregates from './components/StageAggregates'
import { defaultScenario } from './components/ScenarioPanel'
import { saveScenarioEntry, loadScenario, deleteScenario, loadIndex, loadLastScenario } from './utils/scenarioStore'
import AboutAurix from './components/AboutAurix'
import HeaderBar from './components/HeaderBar'
import Footer from './components/Footer'
import { computeDiagnosticsFromTrace } from './utils/diagnostics'
import Sweeps from './components/Sweeps.tsx'

const API = '' // proxied to 8080 via Vite config

export default function App() {
  const [scenario, setScenario] = useState(() => loadLastScenario())
  const [run, setRun] = useState(null)
  const [runs, setRuns] = useState(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('sim_runs') : null
    return saved ? JSON.parse(saved) : []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [compareIds, setCompareIds] = useState([])
  const [activeTab, setActiveTab] = useState(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('active_tab') : null
    return saved || 'results'
  })
  const [timelineHeight, setTimelineHeight] = useState(false)
  const [timelineCurrent, setTimelineCurrent] = useState(0)
  const [timelineZoom, setTimelineZoom] = useState(0.4)
  const [highlightActive, setHighlightActive] = useState(true)
  const [heatOverlay, setHeatOverlay] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [inspectorOpen, setInspectorOpen] = useState(() => {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem('inspector_open') : null
    return v ? v === '1' : false
  })
  const [counters, setCounters] = useState({ queued: 0, gpu: 0, transfer: 0, cpu: 0, total: 0 })
  const [timelineMeta, setTimelineMeta] = useState({ end: 0 })
  const [selectedSpan, setSelectedSpan] = useState(null)
  const [diagnostics, setDiagnostics] = useState(null)
  const rafRef = useRef()
  const [collapsed, setCollapsed] = useState(false)
  const [panelWidth, setPanelWidth] = useState(() => {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem('panel_width') : null
    return v ? parseInt(v, 10) : 380
  })
  const [resizing, setResizing] = useState(false)
  const [savedList, setSavedList] = useState(loadIndex())
  const runA = runs.find((r) => r.id === compareIds[0])
  const runB = runs.find((r) => r.id === compareIds[1])

  const addRun = (newRun) => setRuns((prev) => [...prev.slice(-9), newRun])

  useEffect(() => {
    localStorage.setItem('sim_runs', JSON.stringify(runs.slice(-10)))
  }, [runs])

  useEffect(() => {
    localStorage.setItem('active_tab', activeTab)
  }, [activeTab])

  useEffect(() => {
    if (!run?.id) {
      setDiagnostics(null)
      return
    }
    let cancelled = false
    fetch(`${API}/v1/runs/${run.id}/trace`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        const diag = computeDiagnosticsFromTrace(json)
        setDiagnostics(diag)
      })
      .catch(() => !cancelled && setDiagnostics(null))
    return () => { cancelled = true }
  }, [run?.id])

  // panel resize handlers
  useEffect(() => {
    if (!resizing) return
    const onMove = (e) => {
      const next = Math.min(520, Math.max(300, e.clientX - 24))
      setPanelWidth(next)
      localStorage.setItem('panel_width', String(next))
    }
    const onUp = () => setResizing(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizing])

  // keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target?.tagName?.toLowerCase()
      if (['input', 'textarea', 'select'].includes(tag)) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'Enter') {
        e.preventDefault()
        handleRun(scenario)
      } else if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        handleSave(scenario)
      } else if (mod && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault()
        handleReset()
      } else if (e.key === 'Escape') {
        setCollapsed(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [scenario])

  const handleRun = async (sc) => {
    setError('')
    setLoading(true)
    setRun(null)
    setScenario(sc)
    try {
      const res = await fetch(`${API}/v1/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: sc }),
      })
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}))
        throw new Error(msg.error || 'Failed to start run')
      }
      const data = await res.json()
      const runId = data.run_id
      const summary = data.summary
      const breakdown = data.breakdown || (await (await fetch(`${API}/v1/runs/${runId}/breakdown`)).json())
      const tracePath = data.artifacts?.trace
      const newRun = { id: runId, summary, trace: tracePath, breakdown, scenario: sc }
      setRun(newRun)
      addRun(newRun)
      setActiveTab('results')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCompare = (aId, bId) => {
    setCompareIds((prev) => [aId ?? prev[0], bId ?? prev[1]])
  }

  const openTimeline = () => setActiveTab('timeline')
  const openRunById = (id) => {
    const r = runs.find((x) => x.id === id)
    if (r) {
      setRun(r)
      setActiveTab('timeline')
    }
  }

  // timeline playback loop
  useEffect(() => {
    if (!playing) return
    const tick = () => {
      setTimelineCurrent((c) => {
        const next = c + 16 * speed
        if (next >= timelineMeta.end) {
          setPlaying(false)
          return timelineMeta.end
        }
        return next
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => rafRef.current && cancelAnimationFrame(rafRef.current)
  }, [playing, speed, timelineMeta.end])

  const handleSave = (sc) => {
    try {
      const { index } = saveScenarioEntry(sc)
      setSavedList(index)
      setToast('Scenario saved')
      setTimeout(() => setToast(''), 1200)
    } catch {
      setToast('Save failed')
    }
  }

  const handleLoad = (id) => {
    if (!id) return
    const sc = loadScenario(id)
    if (sc) {
      setScenario(sc)
      setToast('Scenario loaded')
      setTimeout(() => setToast(''), 1200)
    }
  }

  const handleDelete = (id) => {
    if (!id) return
    if (!confirm('Delete saved scenario?')) return
    const idx = deleteScenario(id)
    setSavedList(idx)
  }

  const handleReset = () => setScenario(defaultScenario)

  const startResize = (e) => {
    e.preventDefault()
    setResizing(true)
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <HeaderBar backendUrl={API} onOpenTimeline={openTimeline} hasRun={!!run} activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 p-4 lg:p-6">
        <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
          <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow h-fit relative" style={{ width: collapsed ? 56 : panelWidth }}>
            <ScenarioPanel
              scenario={scenario}
              setScenario={setScenario}
              onRun={handleRun}
              onSave={handleSave}
              onReset={handleReset}
              savedList={savedList}
              onLoad={handleLoad}
              onDelete={handleDelete}
              toast={toast}
              collapsed={collapsed}
              setCollapsed={setCollapsed}
            />
            <div
              className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
              onMouseDown={startResize}
              title="Drag to resize"
            />
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-xl shadow relative">
            <Tabs
              tabs={[
                { id: 'results', label: 'Results' },
                { id: 'timeline', label: 'Timeline' },
                { id: 'compare', label: 'Compare' },
                { id: 'sweeps', label: 'Sweeps' },
              ]}
              active={activeTab}
              onChange={setActiveTab}
            />
            <div className="p-4 space-y-4">
              {activeTab === 'results' && (
                <div className="space-y-3">
                  {(!run && !loading) ? (
                    <div className="flex items-center justify-center min-h-[340px]">
                      <div className="text-center space-y-4 max-w-md">
                        <div className="flex items-center justify-center">
                          <div className="h-14 w-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                            <svg width="32" height="32" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                              <path d="M8 46h20M14 34h26M22 22h26" stroke="#34D399" strokeWidth="3" strokeLinecap="round" />
                              <path d="M12 50c0-12 7-22 18-26s22-1 30 8" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 4" />
                            </svg>
                          </div>
                        </div>
                        <div className="text-xl font-semibold text-slate-100">No results yet</div>
                        <div className="text-sm text-slate-400 leading-relaxed">Define a scenario and run a simulation to visualize GPU workload behavior.</div>
                        <div className="flex items-center justify-center gap-3">
                          <button className="px-5 py-2.5 rounded-md bg-emerald-500 text-slate-950 font-semibold shadow-sm" onClick={() => handleRun(scenario)}>Run Simulation</button>
                          <div className="text-xs text-slate-500">Start with the default scenario</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <RunResults scenario={scenario} run={run} loading={loading} error={error} onOpenTimeline={openTimeline} diagnostics={diagnostics} />
                    </>
                  )}
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-3">
                  {!run && <div className="text-slate-400 text-sm">Run a scenario to see the timeline.</div>}
                  {run && (
                    <>
                      <TimelineControls
                        playing={playing}
                        onTogglePlay={() => setPlaying((p) => !p)}
                        current={timelineCurrent}
                        end={timelineMeta.end}
                        onScrub={(v) => { setTimelineCurrent(v); setPlaying(false) }}
                        speed={speed}
                        onSpeed={setSpeed}
                        zoom={timelineZoom}
                        onZoom={setTimelineZoom}
                        highlight={highlightActive}
                        onHighlight={setHighlightActive}
                        heatOverlay={heatOverlay}
                        onHeatOverlay={setHeatOverlay}
                        counters={counters}
                        onToggleInspector={() => {
                          const next = !inspectorOpen
                          setInspectorOpen(next)
                          localStorage.setItem('inspector_open', next ? '1' : '0')
                        }}
                        primaryBadge={diagnostics?.primary}
                      />

                      <div className={`grid gap-3 ${inspectorOpen ? 'lg:grid-cols-[1fr,280px]' : 'lg:grid-cols-[1fr]'} `} style={{ minHeight: timelineHeight ? 520 : 420 }}>
                        <div className="min-h-[420px]">
                          <TimelineViewer
                            runId={run.id}
                            backendUrl={API}
                            height={timelineHeight ? 520 : 420}
                            current={timelineCurrent}
                            onCurrentChange={(v) => { setTimelineCurrent(v) }}
                            zoom={timelineZoom}
                            highlightActive={highlightActive}
                            heatOverlay={heatOverlay}
                            onActiveChange={setCounters}
                            onMeta={setTimelineMeta}
                            selected={selectedSpan}
                            onSelect={setSelectedSpan}
                            compact={inspectorOpen === false}
                          />
                        </div>
                        {inspectorOpen && (
                          <div className="space-y-3 bg-slate-900/70 border border-slate-800 rounded p-3">
                            <div className="flex items-center justify-between text-sm text-slate-200">
                              <span>Inspector</span>
                              <button className="text-slate-400" onClick={() => { setInspectorOpen(false); localStorage.setItem('inspector_open', '0') }}>✕</button>
                            </div>
                            <div className="text-xs text-slate-500">Selected span details and stage breakdown</div>
                            <RequestDetails breakdown={run.breakdown} selectedId={selectedSpan ? selectedSpan.requestId : null} />
                            <StageAggregates aggregates={run.breakdown?.stage_aggregates} />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'compare' && (
                <CompareView runs={runs} compareIds={compareIds} onSelect={handleCompare} backendUrl={API} />
              )}

              {activeTab === 'sweeps' && (
                <Sweeps
                  backendUrl={API}
                  baseScenario={scenario}
                  addRun={addRun}
                  openRun={openRunById}
                  setActiveTab={setActiveTab}
                />
              )}

              {activeTab === 'docs' && (
                <div className="p-2">
                  <AboutAurix />
                </div>
              )}

              {activeTab === 'help' && (
                <div className="text-sm text-slate-300 space-y-2">
                  <div className="font-semibold text-slate-100">How to read</div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Lanes: QUEUE (waiting), CPU (pre/post), H2D/D2H (transfers), GPU (compute).</li>
                    <li>Each bar is a stage span for a request; overlap means parallel work.</li>
                    <li>Playback cursor shows current time; active spans brighten, counters update live.</li>
                    <li>Use Zoom and Speed to inspect hot spots; indicators call out queueing or GPU saturation.</li>
                    <li>Upload an Nsight sqlite to see a real trace; overlay/compare from the Timeline/Compare tabs.</li>
                  </ul>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
