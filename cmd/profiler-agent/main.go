package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"

	"simulator/pkg/nsys"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		return
	}
	switch os.Args[1] {
	case "ingest-nsys":
		ingestCmd := flag.NewFlagSet("ingest-nsys", flag.ExitOnError)
		sqlite := ingestCmd.String("sqlite", "", "path to nsys sqlite export")
		outTrace := ingestCmd.String("out", "trace.json", "path to write chrome trace json")
		outMetrics := ingestCmd.String("out-metrics", "metrics.json", "path to write metrics json")
		_ = ingestCmd.Parse(os.Args[2:])
		if *sqlite == "" {
			log.Fatalf("--sqlite is required")
		}
		trace, metrics, err := nsys.ParseSQLite(*sqlite)
		if err != nil {
			log.Fatalf("ingest failed: %v", err)
		}
		if err := os.WriteFile(*outTrace, trace, 0o644); err != nil {
			log.Fatalf("write trace: %v", err)
		}
		mbytes, _ := json.MarshalIndent(metrics, "", "  ")
		if err := os.WriteFile(*outMetrics, mbytes, 0o644); err != nil {
			log.Fatalf("write metrics: %v", err)
		}
		fmt.Println("ingest complete")
	case "export-nsys":
		exportCmd := flag.NewFlagSet("export-nsys", flag.ExitOnError)
		rep := exportCmd.String("rep", "", "path to .nsys-rep")
		out := exportCmd.String("sqlite-out", "report.sqlite", "output sqlite path")
		_ = exportCmd.Parse(os.Args[2:])
		if *rep == "" {
			log.Fatalf("--rep is required")
		}
		if err := nsys.ExportRep(*rep, *out); err != nil {
			log.Fatalf("export failed: %v", err)
		}
		fmt.Println("export complete")
	default:
		usage()
	}
}

func usage() {
	fmt.Println("profiler-agent commands:")
	fmt.Println("  ingest-nsys --sqlite <path> --out trace.json --out-metrics metrics.json")
	fmt.Println("  export-nsys --rep <path> --sqlite-out report.sqlite (requires nsys on PATH)")
}
