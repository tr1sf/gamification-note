---
name: full-review
description: "Comprehensive PR code review. Runs tests, does a first-pass scan, then launches specialized agents via agent-review-panel for deep analysis. Use instead of built-in /review for thorough reviews."
---

# Full Code Review

Structured PR review: manual first-pass + specialized agent panel for depth.

## CRITICAL: Do Not Downgrade Agent Findings

**You MUST present all SUGGEST+ findings to the user for their decision.** Do not dismiss, rationalize, or downgrade findings yourself — even if you think they're low-risk. Your job is to verify (filter out false positives only), then **present the rest with your assessment and let the user decide**.

If 2+ agents flag something, it goes in the review output regardless of your opinion. If you catch yourself writing "low risk," "not exploitable," "theoretical," or "not actionable in this PR" — STOP. That's rationalization. Present it.

**Trigger frequency ≠ fix complexity.** A bug that fires on normal user conditions (flaky WiFi, Heroku dyno cycle, bad cell signal) is not "backlog" just because the fix has nuance. Classify severity by *how often will this fire × how bad is the impact*, never by *how hard is the fix*. If you catch yourself labeling a normal-conditions bug as "P1 backlog," that's the same rationalization dressed up in priority language.

**Why this rule exists:** In a prior review, 7/19 agents flagged a cache-key-injection finding. The reviewer (you) dismissed it every time as "low risk with Redis." The user later discovered it was a real resource-exhaustion vector (10MB cookie → 10MB Redis key × 50 req/sec = Redis OOM in seconds). The 2-line fix was trivial. The dismissal cost hours.

## CRITICAL: Evaluate Agent Fix Suggestions Separately

When multiple agents flag the same bug, **trust the bug, but evaluate each proposed fix on its own merits**. Different agents propose different fixes for the same finding, and the first or most popular suggestion is not always correct. Always extract the agent's *suggested fix* alongside the *finding* and present both to the user — don't just grab the issue text.

**Why this rule exists:** On BOOKL-17 cold pass, three S++ agents flagged a `ReviewList.tsx` divide-by-zero bug:
- Test Results Analyzer suggested `data.results.length || 1` — **wrong**: `Math.ceil(11 / 1) = 11`, the bug still happens.
- Solidity suggested "use a fixed PAGE_SIZE constant or pass page_size from the caller" — correct.
- Godot Gameplay suggested "use server page size or `data.next == null` to determine last page" — correct.

If you grab the first suggestion that sounds plausible, you can ship green tests with the bug intact. Always trace each proposed fix on the failing case before picking one. Prefer fixes that change the structure of the input over fixes that paper over the symptom (`|| 1`, `?? defaults`, `try/catch swallow`).

## CRITICAL: Cold Pass After Fixes Is Not Optional

After applying fixes, **always run a cold pass** with fresh agents (no exclusion list, no awareness of prior findings). Primed agents rationalize away issues they've already "accepted" — fresh eyes catch what warm passes miss AND verify that fixes didn't introduce new bugs.

**Why this rule exists:** On BOOKL-17 the cold pass found bugs *I introduced in my own fixes*: `text-accent` contrast regression (used in 17 places after consolidation), divide-by-zero in ReviewList pagination, missing focus indicators on buttons that previously had them, and a double `<h1>` after I removed Layout's heading. None of these were in the diff before my fixes — they all came from the fix work itself. Without the cold pass I'd have shipped six accessibility/correctness regressions.

## How to Execute

1. Fetch PR metadata: `gh pr view <number> --json title,body,baseRefName,headRefName,additions,deletions,changedFiles`
2. Fetch diff: `gh pr diff <number>` and `gh pr diff <number> --name-only`
3. Read the full diff — do NOT skip files
4. **Run tests** for all changed apps/packages. Backend: `docker compose run --rm backend python -m pytest <changed-apps> --no-cov -q` (use timeout ≥ 300000ms — full suite can take 4+ minutes). Frontend: `cd frontend && npx vitest run`. Include any failures in the review output.
5. **First-pass scan** (you do this yourself, before agents):
   - Completeness: every endpoint has auth, perms, CSRF, validation, tests
   - Consistency: uses established patterns (TanStack Query, Zod schemas in dedicated files, etc.)
   - Atomicity: multi-step writes wrapped in `transaction.atomic()`
   - Ordering: any `annotate()` has explicit `.order_by()`
   - Cross-reference: grep for how similar things are done elsewhere
   - Composition: when the same component is used 2+ times on a page, compare rendering guards, props, and wrapper conditions — ask "why are these different?"
   - **E2E coverage**: For every new page or multi-step user flow (forms, mutations, auth-dependent behavior, cookie flows), check if E2E tests exist. Use the `e2e-testing-strategy` skill to determine what needs coverage. Unit tests alone don't catch integration failures (CSRF handshake, cookie lifecycle, navigation after mutation, anonymous-to-authenticated transitions). Flag missing E2E tests as FLAG, not SUGGEST — they catch a different class of bugs.
6. **Verify framework patterns via context7**: For non-trivial framework/library usage, check current official docs for gotchas.
7. **Agent Review Panel** — launch specialized agents for deep analysis:
   - **MANDATORY**: Invoke the `agent-review-panel` skill FIRST to check the actual leaderboards. NEVER pick agents by name intuition — "Architect" in the name does NOT predict architecture quality. The real Architecture S++ are Data Engineer, Compliance Auditor, Test Results Analyzer.
   - Use ALL S++ agents from the PR-type leaderboard + ALL S++ from Architecture/Clean Code Leaderboard:
     - **Frontend-heavy**: ALL S++ from Frontend + ALL S++ from Architecture (~3 unique agents)
     - **Backend-heavy**: ALL S++ from Backend + ALL S++ from Architecture (~4 unique agents)
     - **Full-stack**: ALL S++ from Full-Stack + ALL S++ from Architecture (~4 unique agents)
   - Fill remaining slots (up to Standard panel size of 4-6) with S+ agents from the relevant leaderboard.
   - **Use Opus model for agents** (`model: opus`). Sonnet finds consensus issues but misses rare bugs. In a PR #13 experiment (52 Sonnet runs vs 7 Opus cold runs), Opus cold found 5 reviewer-matching hits where Sonnet found 0. The cost difference is worth it for S++ agents finding rare bugs — that's the entire point of the panel.
   - Tell each: "use all available skills (`ui-ux-pro-max`, `solid-review`, `owasp-security`, `pytest-django-patterns`, `react-best-practices`) AND use `context7` to look up current documentation for any library you encounter — check actual library docs for default behaviors and gotchas before assuming code is correct. Read the code, report only failures with file:line, **and propose a concrete fix for each finding**, under 200 words"
   - Consolidate: 2+ agent consensus filters out false positives, but **consensus count is NOT a priority signal**. High-consensus findings are often well-known anti-patterns with low real impact; low-consensus findings from a specialist whose lens matches the PR genre (Solidity on payment flows, Embedded Firmware on crash safety, Test Results Analyzer on ISP leaks) are often the real critical bugs. Prioritize by (a) severity of trigger + (b) specialist-lens match, not by vote count. A single specialist in their lane outranks five generalists with nits.
   - **Capture each agent's proposed fix alongside the finding**, not just the issue text. When multiple agents flag the same bug, they often propose different fixes — compare them side-by-side and trace each on the failing case before picking one. The first or most popular suggestion isn't always correct (see "Evaluate Agent Fix Suggestions Separately" above).
   - **FLAG triage cross-check** — once you have a consolidated FLAG list, feed the full list back to ALL the same real specialized subagent_types (parallel, single turn each) and ask for `FIX (diff) or NOT-A-BUG (verified reason)` per FLAG. This catches two failure modes in one step:
     1. **False positives** — a FLAG one agent reports may be NOT-A-BUG when cross-verified by the others (e.g., "`model_dump()` mutation" flipped from FLAG to unanimous NOT-A-BUG after triage).
     2. **Better fixes** — you get 7 independent diffs per real bug to compare side-by-side. Pick by *fix correctness*, not by fix count. Some agents invent plausible-sounding but factually-wrong rationale in their diffs (e.g., "Xplan and Intelliflo are exposed natively" when they're removed entirely); trace each diff against the code, not the wording.
     Triage prompt template (each agent gets the same body):
     ```
     Worktree: <path>
     For EACH finding, read the cited lines and verdict FIX (with diff) or
     NOT-A-BUG (with what you verified). Commit to one side per finding.
     <FLAG list with file:line + symptom>
     Cap 300 words. Do not edit files — propose only.
     ```
     Per-FLAG consensus matrix:
     | Finding | Godot | Solidity | IR | SRE | DE | Compliance | TRA | Consensus |
     Split verdicts (3/7 FIX, 4/7 NOT-A-BUG) mean the finding deserves deeper code reading *by you*, not a vote — specialists reason from different lenses and each may be right in its own frame.
   - **Per-FLAG walkthrough** — for every finding that survives triage, write a short narrative in this shape BEFORE prescribing the fix. Purpose: let the human reviewer audit whether each FLAG actually stands up, and surface plausible author intent you may have dismissed.
     ```
     ### <FLAG ID> — <one-line symptom>

     **The seam**: <which two layers the bug lives between — docs↔code, spec↔impl,
     tool-signature↔skill-instructions, etc. Most real PR bugs live at seams.>

     **What the author wanted**: <steelman the intent. What was the author
     trying to achieve when they wrote this code? Read the module docstring,
     adjacent comments, the PR description, the Linear story. If you can't
     articulate a coherent intent, you haven't understood the code yet — go back.>

     **What they wrote**: <actual code snippet with file:line; 3-10 lines tops>

     **Why it caused a FLAG**: <the specific runtime / contract / LLM-behavior
     failure mode. Point to the exact observable: "LLM will not recognize the
     error string", "first canvas call 422s", "tool-level errors print on
     stdout with exit 0". Not "this is messy" — "this breaks X when Y".>
     ```
     **Deliberately steelman the intent.** For F4b in PR #1926, the user
     hypothesized "maybe the author was reducing token cost" about a silent
     `{}` fallback for missing `$ref`s — and checking the module docstring
     ("tokenizes ~60-75% smaller") + a test named `test_resolve_missing_def_safe`
     confirmed the author DID intend the silent fallback as robustness. What
     looked like F4b FLAG was partially a design choice; downgrade to SUGGEST +
     propose stderr warning instead of return-tree marker. Without this step,
     you ship a FLAG that overrides deliberate author judgment.
     **If the author intent survives scrutiny** (there's a real rationale grounded
     in code/comments/tests, not just "they probably meant X"), demote the
     finding or propose a fix that preserves the intent while addressing the
     symptom. Record the intent-check explicitly in the walkthrough — don't
     suppress it just because the finding survives.
   - **Deep pass loop** — Re-run S++ agents iteratively, each pass fed the full exclusion list of prior findings:
     - **Pass 2**: Tell agents what was found in pass 1, ask them to dig deeper for what they missed
     - **Pass 3+**: Feed the cumulative exclusion list, shrink word limit (150 words), tell them "absolute bottom — say 'No new findings' if exhausted"
     - **Continue if**: ≥2 new SUGGEST+ findings OR any 1 new Critical finding
     - **Stop when**: <2 new SUGGEST+ findings AND 0 new Critical, OR all agents return "No new findings"
     - Typical depth: 2-3 passes before diminishing returns. Each pass surfaces ~30-50% fewer new issues. Empirical from PR #13: Pass 1 (15 unique), Pass 2 (7 new), Pass 3 (2 new).
     - **WARNING: Exclusion list overload** — Large exclusion lists (20+ items) hurt more than they help. In PR #13, Opus with 25-item exclusion list found 0 new issues; Opus cold (no exclusion list) found 5. Agents spend reasoning budget filtering instead of looking. Cap deep passes at 2-3, then switch to a cold pass.
   - **Fix with TDD** — Every accepted fix MUST follow Red-Green-Refactor. Write the failing test first — the Red phase proves the bug is real (replaces a separate verify step). If a unit test cannot reproduce it AND an integration/E2E test also cannot, document why in the commit message.
   - **Guardrail tests need a probe.** When a test verifies "implementation X preserves behavior Y," and the *default* (no-X) behavior already matches Y, the test is not Red — it's passing for the wrong reason. You must temporarily break the implementation in a direction that would fail the test to prove it has teeth. Example: testing "dedup doesn't over-fire on modified carts" against a codebase with no dedup passes trivially (2 carts → 2 orders matches the assertion). Make the helper dedup *everything* for 30 seconds, run the guardrail, confirm Red, then restore and confirm Green.
   - **Run the full relevant suite after each cycle, not just the new test.** Mock-boundary assertions can mask collateral damage (a new kwarg breaks existing `assert_called_once_with` tests in files you didn't touch). Catching this per-cycle is cheap; catching it later costs a revert + debug loop.
   - **Final cold pass (after fixes)**: Re-run ALL S++ agents (from relevant leaderboard(s) + Architecture = ~4 agents) one last time with NO context about prior findings, against the FIXED code — primed agents rationalize away issues they've already "accepted"; cold eyes on fresh code catch what warm passes miss and verify fixes didn't introduce new issues. Do NOT use only the 2 minimum-floor agents — cold passes need full S++ coverage.
     - **Cold pass MUST have zero exclusion list.** Do NOT include prior findings. In PR #13 experiment, warm Opus with 25-item exclusion list found 0/7 issues; cold Opus with 0-item list found 5/7. The exclusion list causes agents to pattern-match against known issues instead of reading with fresh eyes.
8. Output findings using the format below

## Output Format

```markdown
## PR #N Review — Title

**PR**: owner/repo#N
**Branch**: `source` -> `target`
**Scope**: X files, +Y / -Z

---

### First-Pass Scan
- [findings from step 5, or "No issues"]

### Agent Review Panel
- [consolidated agent findings, grouped by severity + specialist relevance, with consensus count as a tie-breaker — not the lead signal]
- [FLAG items: real bugs, whether flagged by 1 specialist or 5 generalists — include each agent's proposed fix and your pick]
- [SUGGEST items: verified findings that don't meet FLAG severity]
- For each multi-agent FLAG, list the proposed fixes side-by-side. Example:
  > **C4: ReviewList divide-by-zero** (3 agents)
  > - Test Results Analyzer: `data.results.length || 1` ⚠️ doesn't fix bug
  > - Solidity: pass `pageSize` from caller — correct
  > - Godot Gameplay: use `data.next == null` — correct
  > **My pick:** Solidity's — pass pageSize from caller (simpler than next-null check)

### Walkthrough (one per surviving FLAG)

For every FLAG that made it past triage, emit a narrative block the user can audit:

> **F1 — SKILL.md documents an error string the CLI never emits**
> **The seam**: SKILL.md (docs) ↔ CLI (code).
> **What the author wanted**: Give the LLM a stable error string to pattern-match, so it reports deployment misconfigs instead of guessing URLs.
> **What they wrote**: `SKILL.md:48` → `MCP_BASE_URL is not set`; `cli.py:60,116` → `missing required env var: BACKEND_BASE_URL`.
> **Why it caused a FLAG**: env var was renamed at an earlier commit; skill never updated. LLM scans output for the documented string, doesn't find it, falls through to default retry-or-guess behavior — defeating the whole "stop and report" rule.

Each walkthrough MUST include a **steelman of author intent**. If you can't articulate one, you haven't understood the code — re-read before prescribing the fix.

### Architecture (SOLID)
- [summary from solid-review]

### Security (OWASP)
- [summary from owasp-security]

### Verdict

[Approve / Request Changes / Needs Discussion] — [one-line rationale]

### Recommended Fixes (if Approve with SUGGESTs)

Pick the 3-5 highest-value fixes from the SUGGEST list — prioritize by:
1. One-line fixes (low effort, high signal)
2. Multi-agent consensus items that have a simple fix
3. Recurring blind spots (desktop/mobile parity, missing error display)

Format: numbered list with fix description, file:line, and estimated effort (one-line / small / medium).
```

## Severity Levels

- **FLAG** — Must fix before merge
- **SUGGEST** — Should fix, not blocking
- **NIT** — Take it or leave it
- **NOTE** — Not actionable in this PR, backlog ticket
