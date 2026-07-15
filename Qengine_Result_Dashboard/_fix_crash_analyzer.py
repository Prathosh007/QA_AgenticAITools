"""Trim crash_analyzer.py: remove everything after the last valid Python line."""
from pathlib import Path

p = Path(r"D:\Qengine_Result_Dashboard\report_generator\crash_analyzer.py")
text = p.read_text(encoding="utf-8")

# The valid new module ends with _run_ps_local.
# Find the FIRST occurrence of the end marker (new module ends there).
END_MARKER = "        raise RuntimeError(f\"Local PowerShell execution failed: {exc}\") from exc\n"
idx = text.find(END_MARKER)
if idx == -1:
    print("ERROR: end marker not found")
else:
    clean = text[: idx + len(END_MARKER)]
    p.write_text(clean, encoding="utf-8")
    print(f"OK. Trimmed to {clean.count(chr(10))} lines.")
