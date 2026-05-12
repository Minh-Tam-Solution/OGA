---
Version: 6.3.1
Date: 2026-05-12
Status: ACTIVE — OGA CTO consolidated response to AI-Platform punch list
Authority: "@cto (OGA)"
Stage: "08-collaborate"
deadline_met: "F1-F5 by 2026-05-14 EOD ✅ | F6 by 2026-05-15 EOD ✅"
related:
  - "docs/08-collaborate/CTO-RATIFY-aiplatform-f6-response-2026-05-12.md (item #2 — F6 disposition ack)"
  - "AI-Platform oga-adr-008-followup-questions-2026-05-12.md (F1-F5 source)"
  - "docs/08-collaborate/HANDOFF-F6-DISPOSITION-RESPONSE-from-aiplatform-2026-05-12.md"
  - "docs/02-design/01-ADRs/ADR-008-cross-platform-gpu-governance.md"
---

# OGA CTO — Consolidated Response to AI-Platform Outstanding Asks

**From**: OGA @cto  
**To**: AI-Platform @cto + @architect + @pm  
**Date**: 2026-05-12  
**Re**: Full punch list disposition — F1-F5 schema, F6 ack, architecture tension, ROI pattern, sprint cadence, upstream issue confirmations

---

## 0. Punch list status at a glance

| # | Priority | Item | OGA action | Status |
|---|---|---|---|---|
| 1 | 🔴 | F1-F5 arbiter API schema | Dispositioned below §1 | ✅ Done (within 2026-05-14 EOD) |
| 2 | 🔴 | F6 disposition ack | See `CTO-RATIFY-aiplatform-f6-response-2026-05-12.md` | ✅ Done (within 2026-05-15 EOD) |
| 3 | 🟡 | Arbiter vs Mac Mini governance owner (ADR-091) | OGA position §3 | ✅ Position locked |
| 4 | 🟡 | F6 ROI pattern → SOP | OGA commits to template §4 | ✅ Committed |
| 5 | 🟢 | Sprint calendar alignment | §5 | ✅ Provided |
| 6 | 🟢 | Upstream issues posting 2026-05-13 | §6 | ✅ No objection |

---

## 1. 🔴 F1-F5 arbiter API schema dispositions

These supplement the Q1-Q5 ratifications from `CTO-RESPONSE-adr-008-aiplatform-q-2026-05-12.md`. AI-Platform raised 5 implementation-level clarifications. CTO answers below are **binding for S14-A advisory mode** and feed forward into ADR-009 (arbiter implementation spec, Sprint 14).

### F1 — Gateway port 8120 bind: `127.0.0.1` vs `0.0.0.0`?

**Decision: `127.0.0.1:8120` (loopback hardening).**

Rationale:
- The arbiter scrapes from the same host (systemd on S1, port 8200 host-network)
- No legitimate cross-host caller for `gateway:8120/metrics`
- `127.0.0.1` reduces blast radius if UFW misconfigures or `ai-net` rules drift
- Aligns with defense-in-depth (existing UFW `172.19.0.0/16 → 8200` rule is sufficient for arbiter-to-bridge traffic; reverse direction is loopback)

**Action for AI-Platform**: in `bflow-ai-gateway` compose, set:
```yaml
ports:
  - "127.0.0.1:8120:8120"
```

If a future requirement emerges (e.g. remote Prometheus from outside S1), reopen as a separate ticket with explicit security review. **Not Phase 1 scope.**

### F2 — `lease_id` origin in Phase 1?

**Decision: OMIT in Phase 1 admission scaffold; ARBITER-MINT in Phase 2.**

Phase 1 (S14-A advisory mode, 2026-05-20):
- Heartbeat from AI-Platform gateway sends `"lease_id": null`
- Arbiter logs heartbeat correlated by `consumer_id + timestamp` (not lease)
- No admission flow live yet → no lease to reference

Phase 2 (S14-B delegate mode, 2026-05-22):
- Admission request returns arbiter-minted `lease_id` (UUID v4, scoped to single `gpu_devices` entry)
- Consumer echoes the minted `lease_id` back in subsequent heartbeats
- Renewal endpoint takes `lease_id` from URL path

**Client-side UUID generation is rejected** — arbiter is the authority on lease identity. Client-gen creates a race window between admission request and renewal.

Add to ADR-008 D5.1 in next revision: `lease_id` field is **server-minted only, never client-supplied**.

### F3 — `eviction_blackout` timezone: UTC vs Asia/Ho_Chi_Minh?

**Decision: Asia/Ho_Chi_Minh (local time).**

Rationale:
- Operators (oncall, IT/Admin, AI-Platform PJM) are all in VN
- Blackout windows reference business hours (08:00-18:00 weekdays for ollama in ADR-008 D7)
- UTC adds mental tax for every config inspection and incident triage
- `consumers.yaml` is human-edited → human-friendly timezone wins

Implementation note: arbiter binary should accept timezone-aware ISO 8601 in blackout config OR a `timezone:` field at config root. Both work. Recommendation: explicit `timezone: "Asia/Ho_Chi_Minh"` at config root, blackouts as `"08:00-18:00"` strings interpreted in that TZ.

AI-Platform: please finalize `consumers.yaml` schema with this convention before 2026-05-20.

### F4 — Voice in-flight synthesis on SIGTERM: grace period vs hard SIGKILL?

**Decision: SIGTERM with 30s grace, then SIGKILL.**

Rationale:
- Aligns with eviction notice grace period in ADR-008 §D5.2 (`grace_period_sec: 30`)
- A 30s grace is enough to complete most TTS synthesis (Piper RTF ~0.05x, MeloTTS RTF ~0.17x → a 30s audio clip generates in ~5s on CPU)
- VieNeu would have needed special handling here, but VieNeu is now cancelled (F6)
- Standard Docker pattern: `stop_grace_period: 30s` in compose

**Voice S124 checkpoint/resume scope**:
- Out of Phase 1 / Phase 2 scope. No checkpoint/resume in initial arbiter.
- If a synthesis is killed mid-stream, client receives a 5xx and retries (Track B's bounded-retry handles this client-side, 1× max).
- If checkpoint/resume becomes a real requirement (long-form audio, audiobook style), reopen as a separate ADR. Not blocking S14-A or WS-C.

For S14-A advisory mode: voice service simply logs the SIGTERM event; no behavior change since advisory mode doesn't enforce.

### F5 — JWT issuer + algo + distribution + rotation?

**Decision (Phase 2 / S14-B activation):**

| Field | Phase 1 (S14-A advisory) | Phase 2 (S14-B delegate) |
|---|---|---|
| `iss` (issuer) | n/a (no JWT enforced) | `oga-gpu-arbiter` |
| `aud` (audience) | n/a | `s1-gpu-consumers` |
| `sub` (subject) | n/a | `<consumer_id>` from D6 registry |
| `exp` (expiry) | n/a | 90 days from issuance |
| Algorithm | n/a | **HS256** (shared symmetric secret) for Phase 2; **RS256** upgrade target for Phase 3 |
| Signing key distribution | static token (any well-formed string accepted) | Phase 2: 1P vault (when available) or `/etc/gpu-arbiter/jwt-secret` chmod 0400 root-only |
| Rotation policy | n/a | Manual rotation every 90 days; CTO + DevOps rotate together; old keys honored for 24h overlap |
| Revocation | n/a | Phase 2: arbiter restart with new key; Phase 3: revocation list endpoint |

**Phase 2 deadline**: CTO ships JWT issuance spec **by 2026-05-19** (2 weeks before S14-B 2026-05-22). AI-Platform integrates JWT validation in scaffold by S14-B start.

**Phase 3 (Sprint 15+)**: upgrade to RS256 + key rotation automation + revocation endpoint. Tracked in ADR-009.

**For AI-Platform's scaffold work (now → 2026-05-20)**:
- Use static token `aiplatform-scaffold-s14a-static` as `X-Consumer-Token`
- Implement header read + forward-to-arbiter (no validation needed)
- Add JWT parsing scaffolding behind feature flag; activate at S14-B with shared secret

---

## 2. 🔴 F6 disposition — see separate doc

All 4 F6 items (Q2 gate date, Q3 sub-decision, D2 footnote, Q4 owner) are dispositioned in:

[`docs/08-collaborate/CTO-RATIFY-aiplatform-f6-response-2026-05-12.md`](CTO-RATIFY-aiplatform-f6-response-2026-05-12.md)

TL;DR:
- Q2 → ACK **2026-06-01**
- Q3 → CONFIRM **(a) B.1 + B.3 combo**
- D2 → RATIFY footnote as proposed
- Q4 → ACK AI-Platform @cto owns upstream arm64 request

---

## 3. 🟡 Architecture tension — Mac Mini governance owner

**OGA CTO position: Option B — AI-Platform owns Mac Mini governance; OGA owns S1 governance.**

### Reasoning

| Factor | Why Option B (split ownership) wins |
|---|---|
| **Role boundary** | OGA = AI generation tools (consumer of GPU). AI-Platform = platform service host (owner of GPU on production host). Mac Mini is production audio + downstream content target → AI-Platform domain. |
| **Existing ADR-008 D1** | Says S1 priority is Ollama-LLM (AI-Platform consumers). Logical extension: when S1 → Mac Mini, consumer set is even more AI-Platform-dominated. Arbiter follows the consumer-set owner. |
| **CEO directive 2026-05-11** | "Production content workloads (audio, image, video) target Mac Mini M4 Pro 48G." Production = AI-Platform's operational responsibility. |
| **Operational reality** | Whoever runs ADR-008-style L2/L3/L4 on-call for the host must own the arbiter for that host. AI-Platform PJM + CTO already on-call rotation per ADR-008 §D7 RACI. |
| **Cross-platform overreach** | Option A (OGA arbiter universal) makes OGA a platform-infrastructure team. That's outside OGA's mission (`OGA = AI generation tools`). |
| **Hybrid risk** | Option C creates dual-control surfaces — two arbiters on one host = priority conflict edge cases, harder to debug, harder to evict cleanly. Reject. |

### Specific commitments under Option B

- **S1 arbiter**: OGA continues to own per ADR-008 (already in place).
- **Mac Mini arbiter**: AI-Platform builds and owns. Can be a port of OGA's arbiter (reuse codebase via fork or library extraction) or a new service.
- **Cross-host coordination**: If OGA video pipelines run on Mac Mini post-cutover, OGA registers as a *consumer* in AI-Platform's Mac Mini registry (same way AI-Platform registers as consumer in OGA's S1 registry today).
- **Interface contract**: Keep the same admission/heartbeat/eviction API shape across both arbiters → consumers don't need two SDKs.

### Codification path

**Recommend ADR-091 written by AI-Platform @architect** with these terms:
1. Mac Mini arbiter is AI-Platform-owned
2. API contract matches ADR-008 §D5 exactly (admission, heartbeat, eviction, lease renewal)
3. OGA registers as consumer for any OGA workload deployed to Mac Mini
4. RACI mirrors ADR-008 §D7 with AI-Platform @architect (R) + AI-Platform @cto (A)
5. Cross-arbiter incidents (one host evicts to relieve the other) → manual L4 escalation in Phase 1; automation deferred to Phase 2 if needed

**OGA CTO co-signs ADR-091 once drafted** (peer review only; AI-Platform owns the decision).

**Alternative if AI-Platform prefers**: amend ADR-090 §D5 with the same content. CTO is neutral on doc location — content matters, not filename.

### Timeline

- ADR-091 draft: AI-Platform @architect, target 2026-05-19 (1 week before S123 kickoff)
- OGA review + co-sign: by 2026-05-23
- Effective: Mac Mini cutover 2026-07-03 (JUL-B)

---

## 4. 🟡 F6 ROI pattern → SOP codification

**OGA CTO commits to codify the pattern.**

Pattern name: **Pre-procurement compatibility validation via personal device**

Deliverable: a reusable template in OGA Sprint planning artifact, mirror in AI-Platform.

Template skeleton:
```
SPIKE TEMPLATE — Pre-procurement compatibility validation
─────────────────────────────────────────────────────────
Use when: Sprint plan introduces new hardware OR new upstream OSS
for production where "does upstream X support architecture Y at all"
is the gating question.

Pre-conditions:
  - Personal device of correct chip family available (e.g. M-series
    Mac for Apple Silicon validation, x86 laptop for AMD64 spike)
  - 2-4h human-supervised window
  - Cleanup checklist binding

Execution:
  - Manifest-only check first (no pulls, no execution) — frequently
    answers the question in <10 min
  - If manifest passes, then pull + execute with hard time-box
  - Halt on first hard fail; do not attempt workarounds

Reporting: 7-section structure (see KIMI-PROMPT-vineu-mps-spike)
Verdict codes: PASS | FAIL | CUDA-ONLY (or arch-equivalent) | PARTIAL
```

**Where it lands**:
- OGA: `docs/02-design/spike-templates/pre-procurement-validation-template.md` (new file, Sprint 14 planning)
- AI-Platform: mirror in their sprint planning templates folder
- Both teams: reference in any Sprint plan that introduces new hardware/OSS

**Owner**: OGA @cto authors v1 (light effort, ~1h). AI-Platform reviews + ports.

**Timeline**: v1 by Sprint 14 kickoff 2026-05-20.

**ROI flag to CEO + CPO**: included in the next OGA CTO weekly digest, no urgent escalation.

---

## 5. 🟢 Sprint calendar alignment

### OGA cadence (current state)

| Sprint | Window | Status |
|---|---|---|
| Sprint 13 | ~2026-05-06 → 2026-05-13 (close target this week) | 🔄 In flight; F6 closed, Track B closed, S118 closed |
| Sprint 14 (S14-A advisory) | 2026-05-20 → ~2026-05-26 | 📅 Planned per ADR-008 |
| Sprint 14 (S14-B delegate) | 2026-05-22 → end of S14 | 📅 Planned per ADR-008 |
| Sprint 15 | ~2026-05-27 → 2026-06-09 | 📅 RULE-VRAM-001 deprecation |
| Sprint 16 | ~2026-06-10 → 2026-06-23 | 📅 |
| Sprint 17 (Mac Mini prep + JUL-A) | ~2026-06-24 → 2026-07-07 | 📅 JUL-A 2026-06-28; JUL-B 2026-07-03 |

### Cross-team sync recommendations

| Date | Type | Purpose | Required attendees |
|---|---|---|---|
| **2026-05-19** | Async checkpoint | F1-F5 schema confirmation + ADR-091 draft review | OGA @architect + AI-Platform @architect |
| **2026-05-22** | Live sync (30 min) | S14-B delegate mode go/no-go | Both CTOs + DevOps + AI-Platform PJM |
| **2026-06-01** | Live sync (45 min) | WS-C decision gate execution | Both CTOs + AI-Platform PJM + CPO |
| **2026-06-15** | Async checkpoint | F6 upstream arm64 response (if any) — informational | Both CTOs |
| **2026-06-28** | Live sync (1h) | JUL-A Mac Mini baseline benchmark review | Both CTOs + DevOps + Architect |
| **2026-07-02** | Live sync (30 min) | JUL-B cutover go/no-go | Both CTOs + CEO + CPO |

**Joint mid-sprint sync in S123 window** (your ask): I recommend **2026-06-01 WS-C gate sync** as the natural one. If AI-Platform wants a second touchpoint earlier (e.g. 2026-05-29 informal status), I'll attend — flag it.

### AI-Platform's calendar vs OGA's

Aligned on key dates:
- 2026-06-01 WS-C gate = mid-S14 OGA + mid-S123 AI-Platform ✅
- 2026-06-28 JUL-A = end-of-S16/start-S17 OGA + mid-S124 AI-Platform ✅
- 2026-07-03 JUL-B = early S17 OGA + late-S124 AI-Platform ✅

No misalignment to resolve.

---

## 6. 🟢 Upstream issues posting 2026-05-13 — confirmation

**OGA has no objection to either posting.** Both are AI-Platform's engine-ownership domain; OGA does not co-sign.

| Issue | Repo | Status |
|---|---|---|
| arm64 build request (Q4) | `pnnbao97/VieNeu-TTS` | Posting 2026-05-13 morning. OGA acknowledges. No co-sign requested or needed. |
| `25hours_single` license inquiry (B.1) | `rhasspy/piper-voices` | Posting 2026-05-13. OGA acknowledges. No co-sign. |

**Optional OGA support**: if AI-Platform wants OGA to react/upvote/comment on either issue to show cross-team interest, ping the issue URL after posting and OGA @cto will react. Not required.

**Hard close dates** (per AI-Platform's response):
- VieNeu arm64: 2026-05-26 (S123 kickoff)
- Piper license: 14-day async window from posting

OGA will not chase upstream maintainers on either thread.

---

## 7. Summary — what's open after this consolidated reply

| # | Item | Owner | Next checkpoint |
|---|---|---|---|
| O1 | D2 footnote applied to ADR-008 | Either team | 2026-05-20 |
| O2 | Upstream arm64 issue posted | AI-Platform @cto | 2026-05-13 morning |
| O3 | Piper license inquiry posted | AI-Platform @architect | 2026-05-13 |
| O4 | `consumers.yaml` finalized with Asia/Ho_Chi_Minh TZ | AI-Platform @architect | 2026-05-20 |
| O5 | JWT issuance spec | OGA @cto | 2026-05-19 |
| O6 | ADR-091 (or ADR-090 §D5 amend) Mac Mini governance | AI-Platform @architect (R) | Draft 2026-05-19; OGA co-sign 2026-05-23 |
| O7 | Pre-procurement spike template v1 | OGA @cto | Sprint 14 kickoff 2026-05-20 |
| O8 | S14-B delegate mode go/no-go sync | Both CTOs | 2026-05-22 |
| O9 | OGA @architect: ADR-007 draft → canonical v5 | OGA @architect | This week |
| O10 | WS-C decision gate execution | Both CTOs + PJM + CPO | 2026-06-01 |
| O11 | B.3 cutover (voice registry soft-delete VieNeu + ADR-090 §D6 amendment) | AI-Platform @architect + @coder | By 2026-06-01 |

**Nothing else outstanding from OGA's perspective.** AI-Platform can proceed with all S123 prep on the basis of this disposition.

---

## 8. Process note — Kimi self-authorization of CTO commits

Internal-only note (no AI-Platform action): I'm tightening hygiene on the OGA side. The commit `df77098 docs(cto): post-F6 ADR-008/ADR-009 updates` by Kimi was technically self-authorized (no @cto directive preceded it). Content is fine (footnotes + cross-doc consistency), so it stays. But future `docs(cto):` commits should be preceded by an explicit CTO directive on disk. This is OGA-internal SDLC discipline, not a cross-team concern.

---

*OGA @cto | Consolidated response to AI-Platform punch list | 2026-05-12 | All deadlines met (F1-F5 by 05-14, F6 by 05-15) | Cross-team alignment clean*
