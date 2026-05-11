---
type: "Track B CPO Conditional Fixes"
date: "2026-05-10"
cpo_countersign: "2026-05-10"
status: "RESOLVED — CPO FINAL COUNTERSIGN APPROVED"
---

# Track B CPO Conditional Fixes

**CPO condition:** Đóng 2 việc trước khi final countersign.

---

## Fix 1: Server-side allowlist (High → Resolved)

**Finding:** API route nhận `voice_id` tùy ý và chuyển thẳng qua gateway. Gọi trực tiếp `POST /api/voice/tts` có thể bypass UI policy.

**Fix:** Added server-side validation in `app/api/voice/tts/route.js`:

```javascript
const ALLOWED_VOICES = [
    'vi-piper-vais1000',
    'vi-melotts-default',
    'en-piper-libritts-f',
];
const ALLOWED_LANGUAGES = ['vi', 'en'];
const ALLOWED_FORMATS = ['wav', 'mp3'];
```

Returns `400 invalid_voice_id` / `invalid_language` / `invalid_format` for any out-of-scope request.

**Tests added:**
- `returns 400 for invalid voice_id (not in allowlist)` ✅
- `returns 400 for invalid language` ✅
- `returns 400 for invalid format` ✅

---

## Fix 2: Bounded retry implementation (Medium → Resolved)

**Finding:** `console.warn` khi timeout nhưng không có lần gọi lại `fetch` thứ hai.

**Fix:** Implemented real 1× bounded retry in `VoiceStudio.jsx`:

- Extracted `_doFetch(signal)` helper
- First failure with `AbortError` or `timeout` → wait 1s → retry once with new `AbortController`
- User cancel (via `handleCancel`) sets `userCancelledRef` → skip retry, return to IDLE
- Second failure → surface error to UI

**Code:**
```javascript
const isRetryable = err.name === "AbortError" || err.message.includes("timeout");
if (isRetryable) {
  console.warn("[VoiceStudio] Bounded retry triggered (1× max)");
  setGenError("Retrying... (1×)");
  await new Promise((r) => setTimeout(r, 1000));
  // ... retry with new controller
}
```

---

## Fix 3: Test gap — force voice override (Low → Resolved)

**Finding:** Test truyền `voiceId` (camelCase) nhưng client đọc `voice_id` (snake_case). Test pass vì default voice trùng với expected.

**Fix:**
- Sửa test `synthesize sends correct payload` → truyền `voice_id` (snake_case)
- Thêm assert `expect.stringContaining('"voice_id":"vi-piper-vais1000"')`
- Thêm test mới `synthesize respects forced voice override (not default)` — force `vi-melotts-default`, verify payload + response engine

---

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| `tests/unit/voice-tts.test.mjs` | **14/14** | ✅ PASS |

**Latency:** 47ms (14 tests)

---

## Files Changed

| File | Change |
|------|--------|
| `app/api/voice/tts/route.js` | Server-side allowlist validation |
| `packages/studio/src/components/VoiceStudio.jsx` | Real 1× bounded retry |
| `tests/unit/voice-tts.test.mjs` | 4 new tests (allowlist ×3, force voice ×1) |
| `src/lib/aiPlatformVoiceClient.js` | Error message includes both env var names |

---

## Ready for CPO Final Countersign

All 3 findings resolved. Server-side governance enforced. Retry implemented. Test gap closed.
