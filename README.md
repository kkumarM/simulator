# Kubernetes GPU Simulator (local-only)

A lightweight, offline simulator that mimics scheduling pods onto a Kubernetes-like cluster with GPU-aware placement. No cloud APIs or networking are required; everything runs locally against JSON inputs.

## Prerequisites
- Go 1.21+ (builds are local only; no external dependencies are fetched)

## Project layout
- `cmd/simulator/main.go` – CLI entry point
- `pkg/cluster` – node/resource models and JSON loader
- `pkg/workload` – pod workload models and JSON loader
- `pkg/scheduler` – simple GPU-aware scheduler (packs GPU pods on GPU nodes; prefers non-GPU nodes for general workloads)
- `configs/*.json` – example cluster and workload definitions

## Run
```sh
cd /home/karthik/simulator
# build (offline)
go build ./cmd/simulator
./simulator \
  -cluster configs/cluster.example.json \
  -workload configs/workload.example.json \
  -strategy binpack \
  -state
```
Flags:
- `-cluster` path to a cluster JSON file
- `-workload` path to workload JSON file
- `-strategy` `binpack` (default) to concentrate pods, or `spread` to balance usage
- `-state` print final node utilization after scheduling

## Input formats
Cluster (`configs/cluster.example.json`):
```json
{
  "nodes": [
    {"name": "gpu-a", "capacity": {"cpuMilli": 16000, "memoryMB": 65536, "gpus": 2}}
  ]
}
```

Workload (`configs/workload.example.json`):
```json
{
  "pods": [
    {"name": "trainer-0", "namespace": "ml", "priority": 100, "resources": {"cpuMilli": 4000, "memoryMB": 8192, "gpus": 1}}
  ]
}
```

## Notes
- The scheduler is intentionally simple: GPU pods must land on GPU-capable nodes; CPU-only pods prefer nodes without GPUs to preserve accelerators.
- Pod `priority` (higher first) is supported; pods with the same priority keep a stable alphabetical order.
- All logic uses only the Go standard library so it can run completely offline.
- Extend `pkg/scheduler` to experiment with spreading, binpacking, or custom constraints.
