package main

import (
	"flag"
	"fmt"
	"os"
	"text/tabwriter"

	"simulator/pkg/cluster"
	"simulator/pkg/scheduler"
	"simulator/pkg/workload"
)

func main() {
	clusterPath := flag.String("cluster", "configs/cluster.example.json", "path to cluster JSON definition")
	workloadPath := flag.String("workload", "configs/workload.example.json", "path to workload JSON definition")
	showState := flag.Bool("state", false, "print final node utilization after scheduling")
	flag.Parse()

	c, err := cluster.Load(*clusterPath)
	if err != nil {
		exitErr(err)
	}

	pods, err := workload.Load(*workloadPath)
	if err != nil {
		exitErr(err)
	}

	decisions, final := scheduler.Run(c, pods)
	printDecisions(decisions)

	if *showState {
		fmt.Println()
		printCluster(final)
	}
}

func printDecisions(decisions []scheduler.Decision) {
	w := tabwriter.NewWriter(os.Stdout, 0, 2, 2, ' ', 0)
	fmt.Fprintln(w, "POD\tNODE\tREASON")
	for _, d := range decisions {
		node := d.Node
		if node == "" {
			node = "unscheduled"
		}
		fmt.Fprintf(w, "%s\t%s\t%s\n", d.Pod.FullName(), node, d.Reason)
	}
	_ = w.Flush()
}

func printCluster(c *cluster.Cluster) {
	w := tabwriter.NewWriter(os.Stdout, 0, 2, 2, ' ', 0)
	fmt.Fprintln(w, "NODE\tCPU USED(m)\tCPU FREE(m)\tMEM USED(MB)\tMEM FREE(MB)\tGPU USED\tGPU FREE")
	for _, n := range c.Nodes {
		remain := n.Remaining()
		fmt.Fprintf(
			w,
			"%s\t%d\t%d\t%d\t%d\t%d\t%d\n",
			n.Name,
			n.Allocated.CPUMilli, remain.CPUMilli,
			n.Allocated.MemoryMB, remain.MemoryMB,
			n.Allocated.GPUs, remain.GPUs,
		)
	}
	_ = w.Flush()
}

func exitErr(err error) {
	fmt.Fprintf(os.Stderr, "error: %v\n", err)
	os.Exit(1)
}
