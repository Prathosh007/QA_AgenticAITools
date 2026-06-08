package models

// TestCase represents a single manual test case stored in the DB.
type TestCase struct {
	ID               string   `json:"id"`
	Functionality    string   `json:"functionality"`
	SubFunctionality string   `json:"sub_functionality"`
	Title            string   `json:"title"`
	Category         string   `json:"category"`
	Priority         string   `json:"priority"`
	Status           string   `json:"status"`
	Version          int      `json:"version"`
	Platform         string   `json:"platform"`
	Steps            []string `json:"steps"`
	ExpectedResult   string   `json:"expected_result"`
	SupportFiles     []string `json:"support_files"`
	IssueID          string   `json:"issue_id"`
	CreatedAt        string   `json:"created_at,omitempty"`
	UpdatedAt        string   `json:"updated_at,omitempty"`
}

// GoatPayload stores the full GOAT execution block for a test case.
// Payload is stored as raw string (the JS execution block).
type GoatPayload struct {
	TCID          string `json:"tc_id"`
	Functionality string `json:"functionality"`
	Component     string `json:"component"`
	Payload       string `json:"payload"` // full JS block: component = ...; testcaseId = ...; payload = {...}; goat.common_funtions...
	CreatedAt     string `json:"created_at,omitempty"`
	UpdatedAt     string `json:"updated_at,omitempty"`
}

// GapReport records a test case step that could not be mapped to a GOAT operation.
type GapReport struct {
	ID            int    `json:"id,omitempty"`
	TCID          string `json:"tc_id"`
	Functionality string `json:"functionality"`
	MissingUtil   string `json:"missing_util"`
	StepText      string `json:"step_text"`
	Suggestion    string `json:"suggestion"`
	CreatedAt     string `json:"created_at,omitempty"`
}

// ExecutionResult stores the outcome of a GOAT test run for a specific test case.
type ExecutionResult struct {
	ID           int    `json:"id,omitempty"`
	TCID         string `json:"tc_id"`
	RunAt        string `json:"run_at,omitempty"`
	Status       string `json:"status"` // pass / fail / error
	ActualOutput string `json:"actual_output"`
	Notes        string `json:"notes"`
}
