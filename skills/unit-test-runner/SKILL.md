---
name: unit-test-runner
description: 'Generate and execute standalone unit test scripts for UEMS native agent code without modifying the source tree. Use when writing throwaway test scripts (shell, PowerShell, Go, Swift, C), running them in the terminal, and reporting pass/fail results for C, C++, Objective-C, Swift, Go, or C# modules.'
user-invocable: false
---

# Unit Test Execution Protocol

Generate standalone, disposable test scripts — run them in the terminal — report results. Tests live in a temporary directory and never touch the source tree.

## When to Use
- When asked to unit-test a function, module, or bug fix
- When verifying correctness of changed code without committing test files
- When the Developer or Orchestrator requests quick validation of a module
- When exploring code behavior through executable test cases

## When NOT to Use
- For manual/QA test case generation (CSV output) — use `manual-test-generation` skill instead
- For integration or end-to-end testing across multiple processes
- For UI-level testing or browser automation
- When the user explicitly asks for test files committed to the repo

---

## Core Principle

> **Tests are scripts, not source code.** Generate a self-contained script in a temp directory, execute it via the terminal, parse the output, and report results. Nothing is added to the repo.

---

## Procedure

### Step 1: Identify the Target

**1.1 Determine what to test:**
- Read the source file(s) that need test coverage.
- Identify exported/public functions, methods, and types.
- Note edge cases: nil/null inputs, empty collections, boundary values, error paths.

**1.2 Determine the language and platform:**

| Source Language | Script Type | Runner |
|----------------|-------------|--------|
| Go | `*_test.go` in temp dir | `go test` |
| Swift | standalone `.swift` test file | `swift test` or `xcrun swift` |
| C/C++ | `.c` / `.cpp` with `main()` | `cc` / `g++` then execute |
| C# | `.csx` script or temp project | `dotnet script` or `dotnet test` |
| Objective-C | `.m` with `main()` | `clang` then execute |
| Shell logic | `.sh` / `.ps1` | `bash` / `pwsh` |

**1.3 Check build context:**
- Read the repo's `Makefile`, `go.mod`, build tags, or project file to understand compile flags.
- For Go: note product and architecture build tags (`-tags="<PRODUCT> <ARCH> netgo"`).

### Step 2: Plan Test Cases

For each function/method under test, plan cases covering:

| Category | Description | Priority |
|----------|-------------|----------|
| **Happy path** | Normal inputs producing expected output | P1 — always include |
| **Error path** | Invalid inputs, missing dependencies, expected errors | P1 — always include |
| **Boundary values** | Zero, empty, max-length, off-by-one | P2 — include for numeric/string/collection params |
| **Nil/null handling** | Nil pointers, null references, optional unwrapping | P2 — include when params are pointer/optional types |
| **Concurrency** | Thread safety, race conditions | P3 — only if function is called concurrently |
| **State transitions** | Before/after state changes, side effects | P2 — include for stateful operations |

**Minimum coverage:** 1 happy path + 1 error path per exported function.

### Step 3: Generate the Test Script

Create a **self-contained, executable script** in a temp directory. The script must:
1. Import/include only what's needed from the target module
2. Define all test cases inline
3. Print clear PASS/FAIL per test case with context on failure
4. Exit with code 0 if all pass, non-zero if any fail
5. Clean up any temp files/resources it creates

**Output location:** Write the script to a temporary working directory:
- **Primary:** `$TMPDIR/uems-unit-tests/` (macOS/Linux) or `$env:TEMP\uems-unit-tests\` (Windows)
- **Fallback:** `/tmp/uems-unit-tests/`
- **File name:** `test_<module>_<timestamp>.<ext>`

#### Go — Temp Test File

Create a `*_test.go` file in a temp directory that imports the target package.

```go
// /tmp/uems-unit-tests/test_parser_20260409.go
package parser_test

import (
    "testing"
    "<module_import_path>"
)

func TestFunctionName_HappyPath(t *testing.T) {
    got, err := parser.FunctionUnderTest(validInput)
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if got != expected {
        t.Errorf("got %v, want %v", got, expected)
    }
}
```

**Run command:**
```bash
cd <repo_root> && go test -v -tags="<PRODUCT> <ARCH> netgo" -run "TestFunctionName" ./<package>/...
```

> For Go, the test file may need to live in the package directory to access internals. If so, write it there, run, then **delete it immediately** after capturing output.

#### Swift — Standalone Executable Test

```swift
// /tmp/uems-unit-tests/test_module_20260409.swift
import Foundation

var passed = 0, failed = 0

func assert(_ condition: Bool, _ msg: String, file: String = #file, line: Int = #line) {
    if condition { passed += 1; print("  PASS: \(msg)") }
    else { failed += 1; print("  FAIL: \(msg) (\(file):\(line))") }
}

// Tests
print("Testing ModuleName...")
assert(functionUnderTest("input") == "expected", "happy path")
assert(functionUnderTest("") == nil, "empty input returns nil")

print("\nResults: \(passed) passed, \(failed) failed")
exit(failed > 0 ? 1 : 0)
```

**Run command:** `swift /tmp/uems-unit-tests/test_module_20260409.swift`

#### C/C++ — Compile-and-Run Test

```c
// /tmp/uems-unit-tests/test_module_20260409.c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int passed = 0, failed = 0;
#define ASSERT_EQ(a, b, msg) do { \
    if ((a) == (b)) { passed++; printf("  PASS: %s\n", msg); } \
    else { failed++; printf("  FAIL: %s (got %d, want %d)\n", msg, (int)(a), (int)(b)); } \
} while(0)

int main(void) {
    printf("Testing module_name...\n");
    ASSERT_EQ(function_under_test(valid_input), expected, "happy path");
    ASSERT_EQ(function_under_test(NULL), -1, "null input returns error");
    printf("\nResults: %d passed, %d failed\n", passed, failed);
    return failed > 0 ? 1 : 0;
}
```

**Run command:**
```bash
cc -o /tmp/uems-unit-tests/test_module /tmp/uems-unit-tests/test_module_20260409.c -I<include_path> -L<lib_path> -l<lib> && /tmp/uems-unit-tests/test_module
```

#### C# — dotnet-script or Temp Project

```csharp
// /tmp/uems-unit-tests/test_module_20260409.csx
int passed = 0, failed = 0;
void AssertEq<T>(T actual, T expected, string msg) {
    if (Equals(actual, expected)) { passed++; Console.WriteLine($"  PASS: {msg}"); }
    else { failed++; Console.WriteLine($"  FAIL: {msg} (got {actual}, want {expected})"); }
}

Console.WriteLine("Testing ModuleName...");
AssertEq(FunctionUnderTest(validInput), expected, "happy path");
AssertEq(FunctionUnderTest(null), default, "null input");

Console.WriteLine($"\nResults: {passed} passed, {failed} failed");
Environment.Exit(failed > 0 ? 1 : 0);
```

**Run command:** `dotnet script /tmp/uems-unit-tests/test_module_20260409.csx`

#### Shell / PowerShell — Direct Execution Test

```bash
#!/usr/bin/env bash
# /tmp/uems-unit-tests/test_module_20260409.sh
set -euo pipefail
PASSED=0; FAILED=0

assert_eq() {
    if [[ "$1" == "$2" ]]; then ((PASSED++)); echo "  PASS: $3"
    else ((FAILED++)); echo "  FAIL: $3 (got '$1', want '$2')"; fi
}

echo "Testing module_name..."
result=$(command_under_test --flag value)
assert_eq "$result" "expected_output" "happy path"

echo -e "\nResults: $PASSED passed, $FAILED failed"
[[ $FAILED -eq 0 ]] && exit 0 || exit 1
```

**Run command:** `bash /tmp/uems-unit-tests/test_module_20260409.sh`

### Step 4: Handle Dependencies

| Dependency | Strategy |
|------------|----------|
| File system | Create temp files/dirs inside the script; clean up on exit via trap |
| Network calls | Mock with local stubs or skip (note as "skipped — requires network") |
| Database | Use in-memory or temp database files |
| System APIs | Test through Agent-Utils wrappers if available |
| Time-dependent | Use fixed/deterministic time values in the script |
| Shared libraries | Link at compile time for C/C++; import for Go/Swift |

**Rule:** Scripts must be self-contained and deterministic. No external server dependencies.

### Step 5: Execute and Report

**5.1 Run the script** via the terminal tool. Capture stdout, stderr, and exit code.

**5.2 Parse output** and present results:

```
## Test Results: <module_name>

| # | Test | Result |
|---|------|--------|
| 1 | happy path | PASS |
| 2 | empty input returns nil | PASS |
| 3 | null input returns error | FAIL — got 0, want -1 |

**Summary:** 2/3 passed, 1 failed
```

**5.3 On failure:**
- Show the failing assertion with actual vs expected values
- Show relevant stderr output if the script crashed
- Suggest the likely cause if diagnosable from the output

**5.4 Cleanup:** After reporting results, note that the script remains at its temp path for manual re-runs. Do NOT delete automatically — the user may want to inspect or re-run it.

### Step 6: Verify Test Quality

Before executing, check each test against:

- [ ] Script is self-contained — no modifications to source tree
- [ ] Each test verifies exactly one behavior
- [ ] Error messages include both actual and expected values
- [ ] No hardcoded paths, ports, or environment-specific values (use temp dirs)
- [ ] Tests are independent — no ordering dependency
- [ ] Script exits non-zero on any failure
- [ ] Cleanup logic handles interrupts (trap in shell scripts)

## Quality Gate

The output must satisfy:
- Minimum 2 tests per exported function (1 happy path + 1 error path)
- All tests are deterministic — no flaky behavior
- Script compiles/runs on the target platform without extra setup
- Results clearly show PASS/FAIL per test case with failure details
- Source tree is unmodified — no files added, changed, or deleted in the repo

---

## Step 7: Generate Report

After executing all test scripts and collecting results, produce a structured markdown report file.

### Report Template

```markdown
# Unit Test Report

**Source:** `<sourceBranch>`
**Target:** `<targetBranch>`
**Platform:** <platform>
**Date:** <YYYY-MM-DD>

## Summary

| Module | Tests Run | Passed | Failed | Skipped |
|--------|-----------|--------|--------|---------|
| <module> | <n> | <n> | <n> | <n> |
| **Total** | **<n>** | **<n>** | **<n>** | **<n>** |

## Test Results

### <Module Name>

#### <TestName> — PASS / FAIL

- **Function:** `<function under test>`
- **Category:** Happy Path / Error Path / Boundary
- **Input:** <description of input>
- **Expected:** <expected result>
- **Actual:** <actual result>
- **Duration:** <ms>

*(repeat per test case)*

## Failed Test Details

> *(Only if failures exist. For each failed test, include the full terminal output.)*

### <TestName> — FAIL

```
<terminal output showing the failure>
```

**Probable cause:** <brief analysis of why the test failed>

## Environment

- **OS:** <os version>
- **Compiler/Runtime:** <compiler or runtime version>
- **Build flags:** <relevant build flags>
```

### Report Rules

1. **Every executed test must appear** in the report — no silent omissions
2. **Failed tests include full terminal output** — the developer needs to see exactly what happened
3. **Probable cause is evidence-based** — reference the actual vs expected values, not guesses
4. **Skipped tests** are listed with the reason (missing dependency, platform mismatch, etc.)
5. **Duration** is captured per test if the runner supports it, otherwise per module

### File Naming

`unit-test-report-<sourceBranch>-vs-<targetBranch>-<YYYY-MM-DD>.md`

Sanitize branch names: replace `/` with `-`.
**Output location:** Workspace root directory (same as test case CSV if produced alongside).
