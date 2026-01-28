package workload

import (
	"encoding/json"
	"fmt"
	"os"

	"simulator/pkg/cluster"
)

// Pod is a simplified workload specification.
type Pod struct {
	Name      string          `json:"name"`
	Namespace string          `json:"namespace"`
	Priority  int             `json:"priority,omitempty"`
	Requests  cluster.Resource `json:"resources"`
}

// FullName combines namespace and name for logging.
func (p Pod) FullName() string {
	if p.Namespace == "" {
		return p.Name
	}
	return p.Namespace + "/" + p.Name
}

// Load reads a workload definition containing pods from a JSON file.
func Load(path string) ([]Pod, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read workload file: %w", err)
	}

	var payload struct {
		Pods []Pod `json:"pods"`
	}

	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("parse workload json: %w", err)
	}

	return payload.Pods, nil
}
