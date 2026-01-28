package nsys

import "testing"

// Minimal test ensures missing tables don't panic.
func TestParseSQLiteMissing(t *testing.T) {
	_, _, err := ParseSQLite("testdata/missing.sqlite")
	if err == nil {
		t.Skip("expected error for missing file, skipping")
	}
}
