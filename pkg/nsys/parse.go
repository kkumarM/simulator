package nsys

import (
	"database/sql"
	"errors"
	"fmt"
	"os/exec"

	_ "github.com/mattn/go-sqlite3"
	"simulator/pkg/trace"
)

// Metrics summarizes a real trace.
type Metrics struct {
	WallTimeMS      float64 `json:"wall_time_ms"`
	KernelTimeMS    float64 `json:"kernel_time_ms"`
	MemcpyTimeMS    float64 `json:"memcpy_time_ms"`
	KernelCount     int     `json:"kernel_count"`
	MemcpyCount     int     `json:"memcpy_count"`
	OverlapEstimate float64 `json:"overlap_estimate"`
}

// ParseSQLite reads an nsys-exported sqlite db and returns chrome trace JSON and metrics.
func ParseSQLite(path string) ([]byte, Metrics, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, Metrics{}, fmt.Errorf("open sqlite: %w", err)
	}
	defer db.Close()

	tr := trace.New()
	var metrics Metrics

	// kernels
	rows, err := db.Query(`SELECT start, end, name FROM CUPTI_ACTIVITY_KIND_KERNEL`)
	if err == nil {
		for rows.Next() {
			var start, end float64
			var name string
			if err := rows.Scan(&start, &end, &name); err == nil {
				startMs := start / 1e6
				endMs := end / 1e6
				tr.AddComplete(name, "gpu", 3, startMs, endMs)
				metrics.KernelTimeMS += endMs - startMs
				metrics.KernelCount++
				if endMs > metrics.WallTimeMS {
					metrics.WallTimeMS = endMs
				}
			}
		}
		rows.Close()
	}

	// memcpy
	rows, err = db.Query(`SELECT start, end, copyKind FROM CUPTI_ACTIVITY_KIND_MEMCPY`)
	if err == nil {
		for rows.Next() {
			var start, end float64
			var kind string
			if err := rows.Scan(&start, &end, &kind); err == nil {
				startMs := start / 1e6
				endMs := end / 1e6
				cat := "h2d"
				if kind == "DeviceToHost" {
					cat = "d2h"
				}
				tr.AddComplete("memcpy", cat, 2, startMs, endMs)
				metrics.MemcpyTimeMS += endMs - startMs
				metrics.MemcpyCount++
				if endMs > metrics.WallTimeMS {
					metrics.WallTimeMS = endMs
				}
			}
		}
		rows.Close()
	}

	traceBytes, err := tr.Marshal()
	if err != nil {
		return nil, Metrics{}, err
	}

	if metrics.WallTimeMS > 0 {
		metrics.OverlapEstimate = estimateOverlap(metrics)
	}
	return traceBytes, metrics, nil
}

func estimateOverlap(m Metrics) float64 {
	if m.WallTimeMS == 0 {
		return 0
	}
	raw := (m.KernelTimeMS + m.MemcpyTimeMS) / m.WallTimeMS
	if raw > 1 {
		raw = 1
	}
	return raw
}

// ExportRep uses nsys to export sqlite.
func ExportRep(rep, out string) error {
	if _, err := exec.LookPath("nsys"); err != nil {
		return errors.New("nsys not found in PATH; install Nsight Systems to use export-nsys")
	}
	cmd := exec.Command("nsys", "export", "--type", "sqlite", "-o", out, rep)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("nsys export failed: %w", err)
	}
	return nil
}
