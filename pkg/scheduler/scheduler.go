package scheduler

import (
	"math"
	"sort"

	"simulator/pkg/cluster"
	"simulator/pkg/workload"
)

// Decision captures the scheduling outcome for a pod.
type Decision struct {
	Pod   workload.Pod
	Node  string
	Reason string
}

// Strategy defines how to pick among viable nodes.
type Strategy string

const (
	// Binpack fills the most loaded viable node first to concentrate workload.
	Binpack Strategy = "binpack"
	// Spread distributes load across nodes to maximize free headroom.
	Spread Strategy = "spread"
)

// Run performs a simple scheduling pass over the provided pods and returns the
// decisions alongside the mutated cluster state.
func Run(base *cluster.Cluster, pods []workload.Pod, strategy Strategy) ([]Decision, *cluster.Cluster) {
	working := base.Clone()
	decisions := make([]Decision, 0, len(pods))

	// Higher-priority pods schedule first; stable for identical priorities.
	sort.SliceStable(pods, func(i, j int) bool {
		if pods[i].Priority == pods[j].Priority {
			return pods[i].FullName() < pods[j].FullName()
		}
		return pods[i].Priority > pods[j].Priority
	})

	for _, pod := range pods {
		nodeIdx, reason := chooseNode(working, pod, strategy)
		if nodeIdx == -1 {
			decisions = append(decisions, Decision{Pod: pod, Node: "", Reason: reason})
			continue
		}

		working.Nodes[nodeIdx].Allocate(pod.Requests)
		nodeName := working.Nodes[nodeIdx].Name
		decisions = append(decisions, Decision{Pod: pod, Node: nodeName, Reason: reason})
	}

	return decisions, working
}

func chooseNode(c *cluster.Cluster, pod workload.Pod, strategy Strategy) (int, string) {
	req := pod.Requests

	if req.GPUs > 0 {
		idx := pickGPUNode(c, req, strategy)
		if idx >= 0 {
			return idx, "scheduled on GPU-capable node"
		}
		if !clusterHasGPU(c) {
			return -1, "no GPU nodes available"
		}
		return -1, "GPU nodes lack free capacity for this pod"
	}

	idx := pickStandardNode(c, req, strategy)
	if idx >= 0 {
		if c.Nodes[idx].HasGPU() {
			return idx, "scheduled on GPU node (no standard nodes fit)"
		}
		return idx, "scheduled on standard node"
	}

	return -1, "no nodes have sufficient free CPU/memory"
}

func pickGPUNode(c *cluster.Cluster, req cluster.Resource, strategy Strategy) int {
	bestIdx := -1
	bestRemainingGPU := math.MaxInt
	bestRemainingCPU := math.MaxInt
	worstRemainingGPU := math.MinInt
	worstRemainingCPU := math.MinInt

	for i := range c.Nodes {
		node := &c.Nodes[i]
		if !node.HasGPU() || !node.CanSchedule(req) {
			continue
		}
		after := node.Remaining().Minus(req)
		switch strategy {
		case Spread:
			if after.GPUs > worstRemainingGPU ||
				(after.GPUs == worstRemainingGPU && after.CPUMilli > worstRemainingCPU) {
				bestIdx = i
				worstRemainingGPU = after.GPUs
				worstRemainingCPU = after.CPUMilli
			}
		default: // Binpack
			if after.GPUs < bestRemainingGPU ||
				(after.GPUs == bestRemainingGPU && after.CPUMilli < bestRemainingCPU) {
				bestIdx = i
				bestRemainingGPU = after.GPUs
				bestRemainingCPU = after.CPUMilli
			}
		}
	}

	return bestIdx
}

func pickStandardNode(c *cluster.Cluster, req cluster.Resource, strategy Strategy) int {
	bestIdx := -1
	bestRemainingCPU := math.MaxInt
	bestRemainingMem := math.MaxInt
	worstRemainingCPU := math.MinInt
	worstRemainingMem := math.MinInt

	// First pass: prefer nodes without GPUs.
	for i := range c.Nodes {
		node := &c.Nodes[i]
		if node.HasGPU() || !node.CanSchedule(req) {
			continue
		}
		after := node.Remaining().Minus(req)
		switch strategy {
		case Spread:
			if after.CPUMilli > worstRemainingCPU ||
				(after.CPUMilli == worstRemainingCPU && after.MemoryMB > worstRemainingMem) {
				bestIdx = i
				worstRemainingCPU = after.CPUMilli
				worstRemainingMem = after.MemoryMB
			}
		default: // Binpack
			if after.CPUMilli < bestRemainingCPU ||
				(after.CPUMilli == bestRemainingCPU && after.MemoryMB < bestRemainingMem) {
				bestIdx = i
				bestRemainingCPU = after.CPUMilli
				bestRemainingMem = after.MemoryMB
			}
		}
	}

	if bestIdx >= 0 {
		return bestIdx
	}

	// Second pass: allow GPU nodes if nothing else fits.
	for i := range c.Nodes {
		node := &c.Nodes[i]
		if !node.HasGPU() || !node.CanSchedule(req) {
			continue
		}
		after := node.Remaining().Minus(req)
		switch strategy {
		case Spread:
			if after.CPUMilli > worstRemainingCPU ||
				(after.CPUMilli == worstRemainingCPU && after.MemoryMB > worstRemainingMem) {
				bestIdx = i
				worstRemainingCPU = after.CPUMilli
				worstRemainingMem = after.MemoryMB
			}
		default:
			if after.CPUMilli < bestRemainingCPU ||
				(after.CPUMilli == bestRemainingCPU && after.MemoryMB < bestRemainingMem) {
				bestIdx = i
				bestRemainingCPU = after.CPUMilli
				bestRemainingMem = after.MemoryMB
			}
		}
	}

	return bestIdx
}

func clusterHasGPU(c *cluster.Cluster) bool {
	for i := range c.Nodes {
		if c.Nodes[i].HasGPU() {
			return true
		}
	}
	return false
}
