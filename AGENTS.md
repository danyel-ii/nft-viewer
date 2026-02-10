# Codex Operating Protocol (Self-Improving + Explainable)

## Non-negotiable background behavior (always-on)
You must maintain two living project documents in the repository root:

1) `agent-learning-protocol.md`
   - Purpose: capture mistakes you made (errors, wrong assumptions, manual corrections) and how they were fixed or prevented.
   - This is your long-term memory for this repo.
   - You must read it at the start of every task and update it whenever a mistake happens.

2) `looking-glass.md`
   - Purpose: a child-friendly explanation of what was built and how the visible app behavior is achieved by code.
   - It must map user-requested features → code locations → how the behavior works.
   - Keep explanations in bite-size paragraphs. Introduce and define new programming words.

If either file is missing, create it immediately using the templates defined below (or your best equivalent).

---

## Working loop (do this for every task)
### A) Start-of-task routine (before coding)
1. Read `agent-learning-protocol.md`:
   - Extract relevant “known failure modes” and “prevention rules” related to today’s task.
   - Apply those guardrails proactively (tests, validation, safer APIs, clearer assumptions).
2. Read `looking-glass.md`:
   - Identify which features will change.
   - Plan how you will update the explanations once implementation changes.

### B) Build + verify
- Implement changes in small, reviewable steps.
- Prefer adding guardrails (tests, type checks, validation, lint rules) when a past mistake suggests it.
- Run the project’s verification commands (tests/lint/typecheck) whenever available.

### C) Write back (mandatory end-of-task)
1. Update `agent-learning-protocol.md`:
   - Log any mistake you made *during this task* (including false starts, failing commands, broken builds, wrong file edits, misread requirements).
2. Update `looking-glass.md`:
   - Add/update the feature explanation(s) affected by this task.

Never finish a task with behavior changes without updating `looking-glass.md`.

---

## What counts as a “mistake” (log it)
Log an entry when any of these happens:
- A command fails (tests, build, lint, typecheck, runtime crash).
- You had to revert/redo because your approach was wrong.
- The user corrects you or clarifies that you misunderstood.
- You introduced a regression or changed behavior unintentionally.
- You discover a missing assumption (env var, config, dependency, OS nuance).
- You wrote code that “works” but violates project conventions.

If multiple mistakes occur, log multiple entries (small is fine).

---

## How to update agent-learning-protocol.md (strict format)
- Add newest entries at the top under “Log (newest first)”.
- Each entry must include:
  - Date
  - Task context
  - Mistake (what went wrong)
  - Symptom (error message or what we observed)
  - Root cause (best explanation; mark as hypothesis if unsure)
  - Fix (exact change made)
  - Prevention (test, lint rule, pattern, checklist item, doc update)
  - References (files/commands; keep logs short; no secrets)

When you see repeated mistakes, create a “Prevention Rule” and apply it immediately (e.g., add a test, add validation, update a command sequence).

---

## How to update looking-glass.md (child-friendly constraints)
- Use short paragraphs.
- Use simple words first, then teach one new programming word at a time.
- Always tie behavior to code:
  - “When you click X… the code in `path/file` runs `functionName()`…”
- Maintain a small glossary (“Words we learned”) and add new terms as you introduce them.
- Focus on *front-end visible behavior* and the “chain of cause and effect”:
  UI action → event handler → state/data change → API call (if any) → response → UI update.

---

## Safety / hygiene
- Never write secrets into either document (API keys, tokens, credentials, private URLs).
- If an error log contains secrets, redact them.
- Prefer describing sensitive values generically: `<REDACTED_TOKEN>`.

---

## Templates (use if missing)
If `agent-learning-protocol.md` does not exist, create it with a sensible template including:
- Purpose
- “How to log entries”
- “Log (newest first)” section with the required fields

If `looking-glass.md` does not exist, create it with:
- Purpose
- Glossary
- Feature map with per-feature sections and file references