# GPU Workload Simulator & Trace Overlay Tool

End-to-end simulator with Go backend and React/Tailwind web UI. Models request pipelines (preprocess → h2d → compute → d2h → postprocess), queueing, GPU bandwidth/compute constraints, and emits Chrome trace JSON for visualization. Supports overlaying real Nsight Systems traces (sqlite) for comparison.

## Requirements
- Go (1.18 here; code targets 1.22 features lightly)
- Node 18+ / npm for the web UI
- Optional: Nsight Systems CLI (`nsys`) if you want to export `.nsys-rep` to sqlite

## Build & Test
```sh
make test          # go test ./...
make build         # build backend binary bin/sim-api
(cd web && npm run test)  # vitest for trace parser
(cd web && npm run build) # web production build
```

## Run backend
```sh
make build
./bin/sim-api       # serves on :8080
```
Dev mode (backend + web dev proxy):
```sh
make dev            # web on :5173, backend on :8080
```

## Web UI
Located in `web/` (Vite + React + Tailwind). Run:
```sh
cd web
npm install
npm run dev    # http://localhost:5173 (proxied to :8080)
# or build
npm run build
```
UI features:
- Scenario builder (pipeline stages, jitter, presets) with inline validation
- Embedded timeline/Gantt with lanes (QUEUE, CPU, H2D, GPU, D2H), zoom/scrub/playback, tooltips, request details
- Live counters during playback (queued, GPU, transfer, CPU); bottleneck cues (GPU saturated / queue forming)
- Run history and basic run comparison
- Trace download link

## API (sim-api)
- `POST /v1/scenarios` → `{scenario_id}`
- `GET  /v1/scenarios/{id}` → scenario JSON
- `POST /v1/runs` with `{ "scenario_id": "..." }` or `{ "scenario": { ... } }` → `{ run_id, summary, breakdown, artifacts.trace }`
- `GET  /v1/runs/{id}` → run summary
- `GET  /v1/runs/{id}/breakdown` → per-stage/per-request breakdown
- `GET  /v1/runs/{id}/trace` → Chrome trace JSON
- Real traces (Nsight Systems):
  - `POST /v1/realtraces` (multipart upload sqlite or .nsys-rep) → `{ real_trace_id }`
  - `GET /v1/realtraces/{id}/trace` → real Chrome trace JSON
  - `GET /v1/realtraces/{id}/metrics` → parsed metrics

Artifacts layout:
```
artifacts/
  runs/<run_id>/...            # (reserved for future persistence)
  realtraces/<id>/trace.json
  realtraces/<id>/metrics.json
  realtraces/<id>/uploaded.*
```

## Example scenario JSON
```json
{
  "name": "demo",
  "workload": { "name": "wl", "rps": 2, "duration_s": 10, "batch_size": 1, "jitter_pct": 5 },
  "target": {
    "name": "L40",
    "tflops": 180,
    "mem_gbps": 3000,
    "ms_per_token": 0.2,
    "h2d_gbps": 32,
    "d2h_gbps": 32,
    "concurrency": 4
  },
  "pipeline": [
    { "name": "preprocess", "kind": "fixed_ms", "value": 2 },
    { "name": "h2d", "kind": "bytes", "value": 8388608 },
    { "name": "compute", "kind": "tokens", "value": 128 },
    { "name": "d2h", "kind": "bytes", "value": 2097152 },
    { "name": "postprocess", "kind": "fixed_ms", "value": 1 }
  ]
}
```

Quick run via curl:
```sh
curl -X POST http://localhost:8080/v1/runs \
  -H 'Content-Type: application/json' \
  -d @scenario.json
curl http://localhost:8080/v1/runs/<run_id>/trace -o trace.json
```
Open `trace.json` in Chrome/Perfetto (chrome://tracing) if desired; UI already embeds a timeline.

## Nsight Systems ingestion
1) Generate sqlite from .nsys-rep (if nsys available):
```sh
nsys profile -o report <your_command>
nsys export --type sqlite report.nsys-rep
```
2) CLI ingest:
```sh
go run ./cmd/profiler-agent ingest-nsys --sqlite report.sqlite --out trace.json --out-metrics metrics.json
```
3) Upload to backend (UI supports upload):
```sh
curl -F "file=@report.sqlite" http://localhost:8080/v1/realtraces
```
Then fetch: `/v1/realtraces/<id>/trace` and `/v1/realtraces/<id>/metrics`.

## Timeline overlay (UI)
- TimelineViewer renders sim trace; upload a real trace to view real spans too (stacked/overlay modes planned).
- Playback controls: play/pause, scrub, speed; live counters show queued/GPU/transfer/CPU active counts; bottleneck tags when GPU saturated or queue forming.
- Legend/help panel explains lanes and overlap.

## Capacity planning (roadmap)
Coming modules will estimate GPU count for target RPS/SLA using simulated service times and simple scaling assumptions.

## Make targets
- `make test`       → go test ./...
- `make build`      → build sim-api
- `make dev`        → run backend + web dev server
- `make web-build`  → npm install + npm run build

## Notes
- Offline friendly; no external services required at runtime.
- If `nsys` is not installed, `export-nsys` reports a clear error; sqlite ingestion still works if you have the export.
