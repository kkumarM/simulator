package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

const artifactsDir = "artifacts"

func saveRealTraceFile(id string, filename string, r io.Reader) (string, error) {
	dir := filepath.Join(artifactsDir, "realtraces", id)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	dst := filepath.Join(dir, filename)
	f, err := os.Create(dst)
	if err != nil {
		return "", err
	}
	defer f.Close()
	if _, err := io.Copy(f, r); err != nil {
		return "", err
	}
	return dst, nil
}

func saveTraceBytes(id string, data []byte) (string, error) {
	dir := filepath.Join(artifactsDir, "realtraces", id)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(dir, "trace.json")
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return "", err
	}
	return path, nil
}

func saveMetrics(id string, data []byte) (string, error) {
	dir := filepath.Join(artifactsDir, "realtraces", id)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(dir, "metrics.json")
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return "", err
	}
	return path, nil
}

func loadFile(path string) ([]byte, error) {
	return os.ReadFile(path)
}

func realTracePaths(id string) (tracePath, metricsPath string) {
	base := filepath.Join(artifactsDir, "realtraces", id)
	return filepath.Join(base, "trace.json"), filepath.Join(base, "metrics.json")
}

func artifactPath(parts ...string) string {
	return filepath.Join(append([]string{artifactsDir}, parts...)...)
}

func ensureArtifacts() error {
	return os.MkdirAll(artifactsDir, 0o755)
}

func realTraceExists(id string) bool {
	trace, metrics := realTracePaths(id)
	if _, err := os.Stat(trace); err != nil {
		return false
	}
	if _, err := os.Stat(metrics); err != nil {
		return false
	}
	return true
}

// simple name to avoid conflicts
func newRealTraceID() string {
	return fmt.Sprintf("rt-%d", time.Now().UnixNano())
}
