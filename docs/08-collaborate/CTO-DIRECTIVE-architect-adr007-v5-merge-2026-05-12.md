---
Version: 6.3.1
Date: 2026-05-12
Status: ACTIVE — CTO directive to @architect for ADR-007 v5 merge + D2 footnote
Authority: "@cto (OGA)"
Stage: "08-collaborate"
target_executor: "Kimi CLI on GPU server S1 / OGA repo / @architect role"
sprint: "Sprint 13"
unblocks: "Sprint 13 close, AI-Platform cross-team open items O1 + O9"
related:
  - "docs/04-build/sprints/sprint-13/ADR-007-update-draft-post-f6.md (PM draft, 12 edits)"
  - "docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md (canonical, currently v4)"
  - "docs/02-design/01-ADRs/ADR-008-cross-platform-gpu-governance.md (D2 footnote target)"
  - "docs/08-collaborate/HANDOFF-F6-DISPOSITION-RESPONSE-from-aiplatform-2026-05-12.md (D2 footnote source text)"
  - "docs/08-collaborate/CTO-RATIFY-aiplatform-f6-response-2026-05-12.md (D2 footnote ratified)"
---

# CTO Directive — @architect: ADR-007 v5 merge + ADR-008 D2 footnote

**From**: OGA @cto  
**To**: @architect (executed by Kimi CLI on GPU server S1, repo workdir)  
**Date**: 2026-05-12  
**Re**: Two small unblockers — merge PM's ADR-007 draft into canonical v5; apply ratified D2 footnote to ADR-008.

---

## 1. Context

Sprint 13 has two doc-level loose ends:
- **ADR-007**: PM filed a 12-edit draft on 2026-05-11 ([`docs/04-build/sprints/sprint-13/ADR-007-update-draft-post-f6.md`](../04-build/sprints/sprint-13/ADR-007-update-draft-post-f6.md)) reflecting VieNeu CANCELLED post-F6. Awaiting @architect approval + canonical merge.
- **ADR-008 D2 footnote**: AI-Platform CTO proposed footnote text in their F6 response; OGA CTO ratified ([CTO-RATIFY-aiplatform-f6-response-2026-05-12.md §3](CTO-RATIFY-aiplatform-f6-response-2026-05-12.md)). Either team can apply; OGA picks it up now.

Both edits are **status-only / textual** — no architectural decision change, no scope change, no new ADR.

---

## 2. Scope of this directive

**@architect authority (Kimi acting as architect):**
- ✅ Apply PM's 12 proposed edits to canonical `docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md`
- ✅ Bump ADR-007 status header to **v5**, revised date **2026-05-12**
- ✅ Apply ratified D2 footnote to canonical `docs/02-design/01-ADRs/ADR-008-cross-platform-gpu-governance.md`
- ✅ One git commit covering both files
- ✅ Push to main

**OUT of scope:**
- ❌ DO NOT remove `aiplatform-voice-vieneu` row from ADR-008 D6 registry. That removal is **deferred to AI-Platform's B.3 cutover** scheduled by 2026-06-01 WS-C gate. Until then D6 row stays with existing F6 FAIL footnote.
- ❌ DO NOT change ADR-007 deciders, scope, or architectural decisions. The change is **status only** (VieNeu DEFERRED → CANCELLED).
- ❌ DO NOT modify the PM draft file. Leave it as historical artifact in sprint-13/.
- ❌ DO NOT touch ADR-009 or any other ADR.
- ❌ DO NOT bump ADR-008 version number for the D2 footnote alone — the footnote is a clarification, not a new revision. Just add the footnote inline; leave existing v1.1 status header as-is.

---

## 3. Step-by-step protocol

### STEP 1 — Read the PM draft + the ratified footnote text

Files to read first:
1. `docs/04-build/sprints/sprint-13/ADR-007-update-draft-post-f6.md` — has 12 numbered edits with exact Find/Replace blocks
2. `docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md` — canonical target
3. `docs/08-collaborate/CTO-RATIFY-aiplatform-f6-response-2026-05-12.md` §3 — has the exact D2 footnote text to apply

### STEP 2 — Apply ADR-007 edits 1-12 in order

For each of the 12 edits in PM's draft:
- Use Edit tool with the exact "Find:" string from the draft
- Replace with the exact "Replace with:" string
- If a Find string is not unique, add surrounding context to make it unique
- If a Find string doesn't match (file may have drifted since 2026-05-11), grep for the unique phrase and adjust the Find string — but DO NOT change the intent of the edit

**Architect judgment calls allowed** (per directive §2 "DO NOT change architectural decisions" guardrail):
- If you find a typo or wording improvement adjacent to the edit, you may include it in the same Edit call as a side-fix
- If you disagree with a specific edit's wording (not its intent), apply your improved wording and note it in the commit message
- If you find the canonical ADR-007 has already been partially updated for any of the 12 (e.g. someone else made one of the same edits), skip that edit and note in commit

### STEP 3 — Bump ADR-007 version header

In the YAML frontmatter or top of canonical ADR-007, find the version/status block and update:

```
Before:
Version: <current>
Status: ... (or Proposed — G2 READY pending Hùng A/B sign-off, etc.)

After:
Version: 5
Date: 2026-05-12
Status: ACCEPTED — VieNeu CANCELLED per F6 spike 2026-05-11; production stack = Piper primary + MeloTTS fallback
Authority: "@architect (with @cto + @cpo sign-off)"
Revision: "v5 2026-05-12 — VieNeu status flip DEFERRED → CANCELLED across all sections"
```

Preserve any existing frontmatter fields (deciders, gate, references, etc.) — only update the version/status/date/revision fields.

If the canonical ADR-007 has a footer line like `*ADR-007 v4 | <date> | <summary>*`, update to:
```
*ADR-007 v5 | 2026-05-12 | VieNeu CANCELLED per F6; production = Piper + MeloTTS | Supersedes v4*
```

### STEP 4 — Apply D2 footnote to ADR-008

Open canonical `docs/02-design/01-ADRs/ADR-008-cross-platform-gpu-governance.md`.

Find the **D2** section header (likely "### D2: Policy Principles" or similar — check the actual ADR-008 D2 wording in your repo copy).

After the existing D2 content (after the table of principles), append a new subsection with the ratified footnote text:

```markdown

#### D2 — F6 spike footnote (added 2026-05-12)

> **Footnote 2026-05-12**: Per F6 spike, `pnnbao/vieneu-tts:serve`
> upstream image is `linux/amd64` only, no `arm64` manifest. PyTorch
> MPS requires native arm64. VieNeu is therefore unavailable on Apple
> Silicon hardware (Mac Mini M4 Pro production target). D2's
> "GPU-only" stance compounds with this distribution constraint — both
> together close the path to VieNeu on the production cutover host.
> Path C.3 (replace) is the resulting WS-C decision.

Sources: `docs/05-test/spike-vineu-mps-ceo-m4pro-2026-05-11.md`,
`docs/08-collaborate/CTO-DISPOSITION-F6-vineu-mps-2026-05-11.md`,
`docs/08-collaborate/CTO-RATIFY-aiplatform-f6-response-2026-05-12.md`.

```

**Important**: do NOT bump ADR-008 version for this footnote. Leave the existing `Status: APPROVED — CTO+CPO countersigned (2026-05-11) | v1.1 Q1-Q5 answers locked` exactly as is. The footnote is a clarification under existing decision, not a new decision.

If the ADR-008 file structure doesn't have a place where this naturally fits after D2, place it as the last bullet/note in D2 with the heading `**Footnote 2026-05-12 — F6 spike outcome**` rather than a new subsection. Architect judgment.

### STEP 5 — Verify

Run these checks before commit:
```
grep -c "DEFERRED" docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md
# Expected: near-zero VieNeu-related DEFERRED entries (some legacy unrelated DEFERREDs may remain)

grep -c "CANCELLED" docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md
# Expected: > 5 (many edits introduce CANCELLED)

grep -c "F6 spike" docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md
# Expected: > 0

grep "Footnote 2026-05-12" docs/02-design/01-ADRs/ADR-008-cross-platform-gpu-governance.md
# Expected: 1 match (the D2 footnote)

grep "v5" docs/02-design/01-ADRs/ADR-007-audio-production-architecture.md
# Expected: > 0 (in the version header / footer)
```

If any check fails, fix and re-verify.

### STEP 6 — Single commit + push

Commit message:
```
docs(architect): ADR-007 v5 merge + ADR-008 D2 footnote (post-F6)

ADR-007 canonical update (12 edits per PM draft 2026-05-11):
- VieNeu status DEFERRED → CANCELLED across all sections
- Architecture diagram comment: vineu removed
- Boundary rule: vineu reference deleted
- 2026-05-11 update note appended with F6 outcome
- Routing decision: vineu cancelled; D6 removal pending B.3 cutover
- Future evaluation entry: cancelled with arm64 condition
- Spike E reference: VieNeu no further evaluation planned
- Evaluation roadmap row: cancelled
- Code comments updated
- VRAM table strikethrough on vineu row
- Model mount path strikethrough
- SQL seed: DO NOT INSERT directive

ADR-008 D2 footnote (companion edit, ratified):
- F6 spike outcome footnote added after D2 (per AI-Platform proposal,
  OGA CTO ratification 2026-05-12)
- ADR-008 version header unchanged (footnote is clarification, not
  new decision)

Sources:
- PM draft: docs/04-build/sprints/sprint-13/ADR-007-update-draft-post-f6.md
- F6 spike: docs/05-test/spike-vineu-mps-ceo-m4pro-2026-05-11.md
- D2 footnote ratified: docs/08-collaborate/CTO-RATIFY-aiplatform-f6-response-2026-05-12.md

Closes Sprint 13 docs loose end; closes cross-team open items O1
(D2 footnote) + O9 (ADR-007 v5 merge) from CTO-CONSOLIDATED-RESPONSE.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Push to main.

---

## 4. Definition of Done

- [ ] Canonical ADR-007 has 12 edits applied
- [ ] ADR-007 version header bumped to v5 with 2026-05-12 date
- [ ] ADR-008 D2 footnote added (footnote-only; version header unchanged)
- [ ] All §5 grep verifications pass
- [ ] Single commit with the message in §6
- [ ] Pushed to `main`
- [ ] Stand-down report: `[CTO: ADR-007 v5 merged; ADR-008 D2 footnoted; Sprint 13 docs complete]`

---

## 5. Time budget

- Read PM draft + canonical ADR-007 + footnote source: ~10 min
- Apply 12 edits: ~20 min (some may need find-string adjustment if file has drifted)
- Bump version header + footer: ~5 min
- Apply D2 footnote: ~5 min
- Verify grep checks: ~3 min
- Commit + push: ~2 min
- **Total**: ~45 min

If any edit's Find string cannot be located, halt and ask CTO before improvising. Architect judgment is allowed on wording adjacent to the intended edit, not on the intent of the edit itself.

---

## 6. After completion

Sprint 13 docs close. Next CTO touchpoints (unchanged from consolidated response):

- **2026-05-19** — JWT issuance spec (CTO authors) + ADR-091 draft review (AI-Platform-led, OGA peer-review)
- **2026-05-20** — Sprint 14 kickoff, pre-procurement spike template v1 (CTO authors), S14-A advisory mode start
- **2026-05-22** — S14-B delegate mode go/no-go sync (both CTOs)

After this directive completes, Kimi may **stand down** unless CTO issues another directive. Do not self-authorize any docs(cto) or docs(architect) commits beyond this scope.

---

*OGA @cto | @architect directive for ADR-007 v5 + D2 footnote | 2026-05-12 | Sprint 13 closing*
