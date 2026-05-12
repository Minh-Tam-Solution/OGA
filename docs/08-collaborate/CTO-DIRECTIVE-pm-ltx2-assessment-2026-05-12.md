---
Version: 6.3.1
Date: 2026-05-12
Status: ACTIVE — CTO directive to @pm + @architect for LTX-2 integration assessment
Authority: "@cto (OGA)"
Stage: "08-collaborate"
target_executor: "Kimi CLI on GPU server S1 / OGA repo / @pm + @architect joint role"
target_repo: "https://github.com/Lightricks/LTX-2"
context: "LTX-Video v1 already integrated in OGA Sprint 10 (LTXPipeline branch in local-server/server.py)"
related:
  - "docs/01-planning/external-repo-assessment-2026-05-06.md (PRIOR PATTERN — OpenReel/OpenShorts/IndexTTS assessment)"
  - "docs/08-collaborate/CTO-REVIEW-external-repos-2026-05-09.md (PRIOR CTO REVIEW)"
  - "docs/02-design/01-ADRs/ADR-002-diffusers-engine.md (current LTX integration)"
  - "local-server/server.py (LTXPipeline branch ~line 380)"
  - "local-server/models.json (LTX entry, cfg=3.0)"
  - "docs/04-build/sprints/sprint-10-wan21-ltx-spike-report.md"
---

# CTO Directive — @pm + @architect: LTX-2 Integration Assessment

**From**: OGA @cto  
**To**: @pm + @architect (executed by Kimi CLI on GPU server S1)  
**Date**: 2026-05-12  
**Re**: Research `Lightricks/LTX-2` for OGA integration. Produce structured assessment in the same format as the 2026-05-06 external-repo report.

---

## 1. Why this matters

OGA already integrated **LTX-Video v1** in Sprint 10 (`LTXPipeline` branch in `local-server/server.py`, models.json entry cfg=3.0, ~9GB VRAM). If `Lightricks/LTX-2` is the v2 successor with meaningful improvements, this is a candidate upgrade for Video Studio. If not, we close the question and move on.

This is **not** a spike — it's a desk-research assessment to decide whether a future spike is justified. Same pattern as the OpenReel/OpenShorts/IndexTTS report on 2026-05-06.

---

## 2. Scope

**@pm + @architect joint authority for this directive:**
- ✅ WebFetch the upstream repo (README, LICENSE, model card if linked)
- ✅ Cross-reference with current OGA LTX v1 integration (server.py LTXPipeline branch, models.json LTX entry)
- ✅ Produce assessment doc at `docs/01-planning/ltx2-assessment-2026-05-12.md`
- ✅ Single commit + push

**OUT of scope:**
- ❌ DO NOT clone, build, or run LTX-2 — desk research only
- ❌ DO NOT touch `local-server/server.py` or `models.json`
- ❌ DO NOT modify ADR-002 (current engine ADR)
- ❌ DO NOT write a Sprint 14 ticket — that's CTO + PJM after the assessment lands
- ❌ DO NOT make integration commitments — assessment ends with a verdict recommendation, not a decision

---

## 3. Mandatory assessment dimensions

Same 7 dimensions as the 2026-05-06 external-repo report. For each: state the finding **and** cite the source (file path, README section, line number, or URL anchor).

### 3.1 — Identity + provenance

- Full repo URL: `https://github.com/Lightricks/LTX-2`
- Maintainer: Lightricks (commercial entity — same as LTX-Video v1)
- License: read LICENSE file verbatim; flag any clauses about commercial use, redistribution, fine-tuning, output ownership
- Latest release tag / version / date
- Stars, forks, recent commit activity (last 30 days)
- Relationship to LTX-Video v1: is this a fork, a successor, a parallel model line, a sibling? Cite README's own framing.

### 3.2 — Model architecture + capabilities

- What does LTX-2 do? (T2V? I2V? V2V? lip-sync? upscaling? extension?)
- Output resolution + duration claims
- Conditioning inputs accepted
- Compare to LTX v1: what's new vs what's same?
- Quality claims in README (benchmark numbers, comparison images/videos)

### 3.3 — Tech stack

- Framework: Diffusers? Custom pipeline? PyTorch native?
- Python version requirements
- CUDA / driver requirements (minimum SM compute capability)
- Dependencies: list the top 10 from requirements.txt or pyproject.toml
- Model weights: where hosted (HuggingFace, GitHub releases, custom CDN), license on weights specifically
- Compatibility with our existing stack:
  - Does our `diffusers` version match?
  - Does our `torch` version match (we're on PyTorch 2.x with bfloat16)?
  - Will it co-exist with Wan2.1, current LTX v1, CogVideoX in same Python env?

### 3.4 — Hardware requirements

- VRAM minimum + recommended (compare to LTX v1's ~9GB)
- Generation time per second of output (claimed)
- Disk space for weights
- Apple Silicon / MPS support: explicitly check README + issues for MPS mentions
  - **Critical for July Mac Mini cutover** — if LTX-2 is CUDA-only with no MPS path, this affects integration timing
- CPU fallback?

### 3.5 — License + legal posture

- License of code (MIT? Apache 2.0? GPL? Proprietary with non-commercial clause?)
- License of weights (often different from code)
- Output ownership clauses (some video models claim rights on generated content — flag if present)
- Trademark / brand restrictions
- Attribution requirements
- Compare to LTX v1 license posture (any change?)

### 3.6 — Integration cost into OGA

Given OGA's existing LTX v1 integration:
- Could LTX-2 plug into the existing `LTXPipeline` branch in `server.py`, or does it need a new branch?
- Models.json: new entry vs in-place upgrade?
- Frontend impact: VideoStudio.js — does the LTX-2 model expose new params (e.g. different cfg range, new conditioning types)?
- Test impact: `tests/unit/sprint-10-video.test.mjs` — schema assertions may need update
- Hot-swap state machine (`src/lib/localModels.js`): any changes?
- Migration: if LTX-2 supersedes v1, do we keep v1 for backwards compat or remove?

### 3.7 — Strategic fit + verdict

- Does LTX-2 fill a known gap in OGA Video Studio? Reference `docs/00-foundation/business-case.md` + `docs/01-planning/requirements.md`
- Comparison vs current OGA video stack (Wan2.1, LTX v1, CogVideoX, AnimateDiff, LivePortrait)
- Comparison vs other candidates not yet integrated (HunyuanVideo, Sora-style models, etc.)
- ROI: integration cost (engineering hours) vs feature/quality gain
- Risks: license drift, upstream abandonment, dependency conflicts
- VRAM contention on S1 (per ADR-008 RULE-VRAM-001) — does LTX-2 fit the existing serial-scheduling budget?

**Verdict** must be ONE of:
- **SPIKE → INTEGRATE** (high confidence, recommended for Sprint 14/15 spike)
- **SPIKE → CONDITIONAL** (worth a spike but specific preconditions must pass; list them)
- **DEFER** (interesting but not now; revisit in N sprints with specific trigger)
- **REJECT** (not a fit; document the reason so we don't revisit blindly)

---

## 4. Output document structure

Create `docs/01-planning/ltx2-assessment-2026-05-12.md` with this skeleton:

```markdown
---
Version: 6.3.1
Date: 2026-05-12
Status: DRAFT — @pm + @architect joint assessment for @cto review
Authority: "@pm draft + @architect tech-review → @cto verdict"
Stage: "01-planning"
target_repo: "https://github.com/Lightricks/LTX-2"
verdict: "<one of: SPIKE-INTEGRATE | SPIKE-CONDITIONAL | DEFER | REJECT>"
---

# LTX-2 Integration Assessment

## TL;DR
<3-5 bullet points + verdict line>

## §1 Identity + provenance
<dimension 3.1 findings>

## §2 Model architecture + capabilities
<dimension 3.2 findings>

## §3 Tech stack
<dimension 3.3 findings>

## §4 Hardware requirements
<dimension 3.4 findings, especially MPS posture>

## §5 License + legal posture
<dimension 3.5 findings, verbatim license quotes for any commercial-use clause>

## §6 Integration cost into OGA
<dimension 3.6 findings, including file paths that would change>

## §7 Strategic fit + verdict
<dimension 3.7 findings, verdict + reasoning>

## §8 Recommended next step
<if SPIKE-*: define spike scope, owner, branch name, acceptance criteria>
<if DEFER: define re-evaluation trigger>
<if REJECT: archive note + reason>

## §9 Sources
<bulleted list of every URL/file/section cited in the assessment>
```

---

## 5. Method discipline

- **Cite everything**: if a claim isn't backed by a URL anchor or file path, it doesn't go in the doc
- **No speculation**: if the README is silent on MPS, say "README does not mention MPS support" — do not infer either way
- **Direct quote** for any license clause that affects commercial use
- **Compare side-by-side** with LTX v1 wherever applicable (we already have LTX v1 in production; that's the natural baseline)
- **Flag gaps**: if a critical dimension cannot be assessed without execution (e.g. "claimed VRAM 12GB but real-world unverified"), say so in §4 and propose what the spike would verify

---

## 6. Tooling

Available to Kimi via WebFetch / WebSearch:
- `WebFetch https://github.com/Lightricks/LTX-2/blob/main/README.md` → README content
- `WebFetch https://github.com/Lightricks/LTX-2/blob/main/LICENSE` → license text
- `WebFetch https://raw.githubusercontent.com/Lightricks/LTX-2/main/requirements.txt` (if exists)
- Existing files: `local-server/server.py` (LTXPipeline section), `local-server/models.json`, `docs/04-build/sprints/sprint-10-wan21-ltx-spike-report.md`

If WebFetch is unavailable, fall back to `WebSearch "Lightricks LTX-2 license"` etc. and cite the search-result excerpt.

---

## 7. Definition of Done

- [ ] `docs/01-planning/ltx2-assessment-2026-05-12.md` created with all 9 sections populated
- [ ] Verdict line in frontmatter matches §7
- [ ] Every claim cited
- [ ] Single commit with message: `docs(pm+architect): LTX-2 integration assessment — <verdict>`
- [ ] Push to main
- [ ] Stand-down report: `[CTO: LTX-2 assessment complete; verdict=<X>; awaiting CTO review]`

---

## 8. Time budget

- WebFetch + read upstream repo: ~15 min
- Cross-reference with existing OGA LTX v1 code: ~15 min
- Draft 9 sections: ~30 min
- Self-review + cite-check: ~10 min
- Commit + push: ~2 min
- **Total**: ~70 min

---

## 9. What @cto does with the result

After Kimi commits the assessment:
1. CTO reads + sanity-checks citations
2. CTO writes verdict ratification (or counter-verdict) at `docs/08-collaborate/CTO-VERDICT-ltx2-2026-05-12.md`
3. If verdict = SPIKE: CTO + PJM open Sprint 14 ticket
4. If verdict = DEFER/REJECT: assessment archived; no further action

Kimi does NOT write the CTO verdict. PM draft → CTO verdict, separate steps, separate authors.

---

## 10. Reminder — Sprint 13 docs work pending

If the prior directive (`CTO-DIRECTIVE-architect-adr007-v5-merge-2026-05-12.md`) is still pending, finish that **first** before starting this LTX-2 assessment. Sprint 13 close is higher priority than new research. Confirm Sprint 13 docs are closed, then proceed to LTX-2 assessment.

---

*OGA @cto | @pm + @architect directive for LTX-2 desk research | 2026-05-12 | Verdict-only output, no integration commitment*
