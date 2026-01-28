import { useEffect, useState } from 'react'
import ScenarioPanel from './components/ScenarioPanel'
import RunResults from './components/RunResults'
import RunHistory from './components/RunHistory'
import TimelineViewer from './components/TimelineViewer'
import CompareView from './components/CompareView'
import Tabs from './components/Tabs'
import ResultCards from './components/ResultCards'
import RequestDetails from './components/RequestDetails'
import StageAggregates from './components/StageAggregates'

const API = '' // proxied to 8080 via Vite config

export default function App() {
  const [scenario, setScenario] = useState(null)
  const [run, setRun] = useState(null)
  const [runs, setRuns] = useState(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('sim_runs') : null
    return saved ? JSON.parse(saved) : []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [compareIds, setCompareIds] = useState([])
  const [activeTab, setActiveTab] = useState(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('active_tab') : null
    return saved || 'results'
  })
  const [timelineHeight, setTimelineHeight] = useState(false)
  const runA = runs.find((r) => r.id === compareIds[0])
  const runB = runs.find((r) => r.id === compareIds[1])

  useEffect(() => {
    localStorage.setItem('sim_runs', JSON.stringify(runs.slice(-10)))
  }, [runs])

  useEffect(() => {
    localStorage.setItem('active_tab', activeTab)
  }, [activeTab])

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
      setRuns((prev) => [...prev.slice(-9), newRun])
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-20 bg-slate-950/90 backdrop-blur">
        <div>
          <h1 className="text-xl font-semibold">GPU Workload Simulator</h1>
          <p className="text-slate-400 text-sm">Simulation + timeline + compare + real trace overlay (upload in UI).</p>
        </div>
        <div className="text-xs text-slate-500">Backend: http://localhost:8080</div>
      </header>

      <main className="p-4 lg:p-6">
        <div className="grid gap-4 lg:grid-cols-[360px,1fr]">
          <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow h-fit">
            <ScenarioPanel onRun={handleRun} />
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-xl shadow relative">
            <Tabs
              tabs={[
                { id: 'results', label: 'Results' },
                { id: 'timeline', label: 'Timeline' },
                { id: 'compare', label: 'Compare' },
                { id: 'help', label: 'Help' },
              ]}
              active={activeTab}
              onChange={setActiveTab}
            />
            <div className="p-4 space-y-4">
              {activeTab === 'results' && (
                <div className="space-y-3">
                  <RunResults scenario={scenario} run={run} loading={loading} error={error} onOpenTimeline={openTimeline} />
                  <ResultCards summary={run?.summary} runId={run?.id} trace={run?.trace} />
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-3">
                  {!run && <div className="text-slate-400 text-sm">Run a scenario to see the timeline.</div>}
                  {run && (
                    <>
                      <div className="flex items-center gap-3 text-sm">
                        <button
                          className="px-3 py-1 rounded bg-slate-800 border border-slate-700 text-slate-200"
                          onClick={() => setTimelineHeight((p) => !p)}
                        >
                          {timelineHeight ? 'Normal height' : 'Full height'}
                        </button>
                        <span className="text-slate-500 text-xs">Request details & breakdown on the right</span>
                      </div>
                      <div className={`grid gap-3 ${timelineHeight ? 'lg:grid-cols-[1fr,280px]' : 'lg:grid-cols-[1fr,260px]'}`}>
                        <div className={timelineHeight ? 'min-h-[420px]' : 'min-h-[340px]'}>
                          <TimelineViewer runId={run.id} backendUrl={API} height={timelineHeight ? 520 : 360} />
                        </div>
                        <div className="space-y-3">
                          <RequestDetails breakdown={run.breakdown} selectedId={null} />
                          <StageAggregates aggregates={run.breakdown?.stage_aggregates} />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'compare' && (
                <CompareView runs={runs} compareIds={compareIds} onSelect={handleCompare} backendUrl={API} />
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
    </div>
  )
}
