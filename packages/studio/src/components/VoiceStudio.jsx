"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Constants ──────────────────────────────────────────────────────────────

const ALLOWED_VOICES = [
  { id: "vi-piper-vais1000", label: "Piper VAIS1000 (Vietnamese)", lang: "vi", engine: "piper" },
  { id: "vi-melotts-default", label: "MeloTTS (Vietnamese)", lang: "vi", engine: "melotts" },
  { id: "en-piper-libritts-f", label: "Piper LibriTTS-F (English)", lang: "en", engine: "piper" },
];

const MAX_TEXT_LENGTH = 5000;

const GEN_STATE = {
  IDLE: "idle",
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(ms) {
  if (!ms) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

async function downloadAudio(url, filename) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Fetch failed");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}

function getErrorMessage(status, defaultText) {
  if (status === 503) return "Service warming up — please retry in a moment.";
  if (status === 404) return "Voice unavailable — please select another voice.";
  if (status === 429) return "Too many requests — please slow down.";
  if (status === 500) return "Server error — please try again later.";
  return defaultText || "Something went wrong. Please try again.";
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function VoiceStudio({ apiKey, droppedFiles, onFilesHandled }) {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("vi");
  const [selectedVoiceId, setSelectedVoiceId] = useState(ALLOWED_VOICES[0].id);
  const [genState, setGenState] = useState(GEN_STATE.IDLE);
  const [genError, setGenError] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [voicesFromApi, setVoicesFromApi] = useState(null);
  const [voicesError, setVoicesError] = useState(null);

  const abortRef = useRef(null);
  const userCancelledRef = useRef(false);
  const textareaRef = useRef(null);

  // Filter voices by selected language
  const voicesForLang = ALLOWED_VOICES.filter((v) => v.lang === language);

  // Sync voice selection when language changes
  useEffect(() => {
    const firstForLang = voicesForLang[0]?.id;
    if (firstForLang && !voicesForLang.find((v) => v.id === selectedVoiceId)) {
      setSelectedVoiceId(firstForLang);
    }
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch available voices from API on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/voice/tts")
      .then((res) => {
        if (!res.ok) throw new Error(`Voices fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setVoicesFromApi(data);
      })
      .catch((err) => {
        if (!cancelled) setVoicesError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Handle dropped text files
  useEffect(() => {
    if (droppedFiles && droppedFiles.length > 0) {
      const textFile = droppedFiles.find((f) => f.type.startsWith("text/"));
      if (textFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = String(e.target.result).slice(0, MAX_TEXT_LENGTH);
          setText(content);
        };
        reader.readAsText(textFile);
      }
      onFilesHandled?.();
    }
  }, [droppedFiles, onFilesHandled]);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) {
      setGenError("Please enter some text to synthesize.");
      setGenState(GEN_STATE.ERROR);
      return;
    }

    // Client-side voice validation (CTO pre-condition #3)
    if (!ALLOWED_VOICES.find((v) => v.id === selectedVoiceId)) {
      setGenError("Selected voice is not allowed.");
      setGenState(GEN_STATE.ERROR);
      return;
    }

    setGenState(GEN_STATE.LOADING);
    setGenError(null);
    setResult(null);
    userCancelledRef.current = false;

    const doFetch = async (signal) => {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          language,
          voice_id: selectedVoiceId,
          format: "mp3",
        }),
        signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = getErrorMessage(res.status, data.error || data.message);
        if (res.status === 404) {
          console.warn("[VoiceStudio] Telemetry: 404 voice unavailable", {
            voice_id: selectedVoiceId,
            language,
            timestamp: new Date().toISOString(),
          });
        }
        throw new Error(msg);
      }
      if (!data.audio_url) {
        throw new Error("No audio URL returned.");
      }
      return data;
    };

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const data = await doFetch(controller.signal);
      const entry = {
        id: data.job_id || `voice-${Date.now()}`,
        text: text.trim(),
        audioUrl: data.audio_url,
        durationMs: data.duration_ms,
        engine: data.engine,
        voiceId: data.voice_id,
        watermarkKey: data.watermark_key,
        createdAt: new Date().toISOString(),
      };
      setResult(entry);
      setHistory((prev) => [entry, ...prev].slice(0, 20));
      setGenState(GEN_STATE.SUCCESS);
    } catch (err) {
      // User cancel — do not retry
      if (err.name === "AbortError" && userCancelledRef.current) {
        setGenState(GEN_STATE.IDLE);
        return;
      }

      // Timeout / network error — bounded retry 1× (CTO pre-condition #4)
      const isRetryable = err.name === "AbortError" || err.message.includes("timeout");
      if (isRetryable) {
        console.warn("[VoiceStudio] Bounded retry triggered (1× max)");
        setGenError("Retrying... (1×)");
        await new Promise((r) => setTimeout(r, 1000));

        const retryController = new AbortController();
        abortRef.current = retryController;
        try {
          const data = await doFetch(retryController.signal);
          const entry = {
            id: data.job_id || `voice-${Date.now()}`,
            text: text.trim(),
            audioUrl: data.audio_url,
            durationMs: data.duration_ms,
            engine: data.engine,
            voiceId: data.voice_id,
            watermarkKey: data.watermark_key,
            createdAt: new Date().toISOString(),
          };
          setResult(entry);
          setHistory((prev) => [entry, ...prev].slice(0, 20));
          setGenState(GEN_STATE.SUCCESS);
          return;
        } catch (retryErr) {
          if (retryErr.name === "AbortError" && userCancelledRef.current) {
            setGenState(GEN_STATE.IDLE);
            return;
          }
          setGenError(retryErr.message);
          setGenState(GEN_STATE.ERROR);
          return;
        }
      }

      setGenError(err.message);
      setGenState(GEN_STATE.ERROR);
    } finally {
      abortRef.current = null;
      userCancelledRef.current = false;
    }
  }, [text, language, selectedVoiceId]);

  const handleCancel = () => {
    userCancelledRef.current = true;
    abortRef.current?.abort();
    setGenState(GEN_STATE.IDLE);
  };

  const handleClear = () => {
    setText("");
    setResult(null);
    setGenState(GEN_STATE.IDLE);
    setGenError(null);
    textareaRef.current?.focus();
  };

  const charCount = text.length;
  const isOverLimit = charCount > MAX_TEXT_LENGTH;

  return (
    <div className="w-full h-full flex flex-col bg-[#030303] text-white overflow-hidden">
      {/* Main workspace */}
      <div className="flex-1 min-h-0 flex">
        {/* Left: Input panel */}
        <div className="flex-1 flex flex-col border-r border-white/[0.03] min-w-0">
          {/* Toolbar */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.03]">
            {/* Language toggle */}
            <div className="flex items-center bg-white/5 rounded-full p-0.5 border border-white/[0.03]">
              {["vi", "en"].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    language === lang
                      ? "bg-[#d9ff00] text-black"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {lang === "vi" ? "Tiếng Việt" : "English"}
                </button>
              ))}
            </div>

            {/* Voice selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/30 font-bold uppercase tracking-wider">Voice</span>
              <select
                value={selectedVoiceId}
                onChange={(e) => setSelectedVoiceId(e.target.value)}
                className="bg-white/5 border border-white/[0.03] rounded-lg px-3 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#d9ff00]/50 min-w-[180px]"
              >
                {voicesForLang.map((v) => (
                  <option key={v.id} value={v.id} className="bg-[#0a0a0a]">
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            {/* API voices status */}
            {voicesError && (
              <span className="text-[10px] text-red-400/80" title={voicesError}>
                API voices unavailable
              </span>
            )}
          </div>

          {/* Textarea */}
          <div className="flex-1 min-h-0 p-6 flex flex-col">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
              placeholder={`Enter text to synthesize (${MAX_TEXT_LENGTH.toLocaleString()} chars max)...`}
              className="flex-1 w-full bg-transparent resize-none outline-none text-sm leading-relaxed text-white/90 placeholder:text-white/20"
              spellCheck={false}
            />
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.03]">
              <span className={`text-xs font-mono ${isOverLimit ? "text-red-400" : "text-white/30"}`}>
                {charCount.toLocaleString()} / {MAX_TEXT_LENGTH.toLocaleString()}
              </span>
              {result && (
                <button
                  onClick={handleClear}
                  className="text-xs text-white/40 hover:text-white transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Generate bar */}
          <div className="px-6 py-4 border-t border-white/[0.03] flex items-center gap-4">
            {genState === GEN_STATE.LOADING ? (
              <>
                <div className="flex-1 h-10 rounded-xl bg-white/5 border border-white/[0.03] flex items-center px-4 gap-3">
                  <div className="w-4 h-4 border-2 border-[#d9ff00]/30 border-t-[#d9ff00] rounded-full animate-spin" />
                  <span className="text-xs text-white/50">Synthesizing...</span>
                </div>
                <button
                  onClick={handleCancel}
                  className="h-10 px-5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!text.trim() || isOverLimit}
                className="h-10 px-6 rounded-xl bg-[#d9ff00] text-black text-xs font-bold hover:bg-[#e0ff33] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
                Synthesize
              </button>
            )}

            {genState === GEN_STATE.ERROR && (
              <div className="flex-1 text-xs text-red-400 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
                {genError}
              </div>
            )}
          </div>
        </div>

        {/* Right: Result + History */}
        <div className="w-[380px] flex-shrink-0 flex flex-col bg-[#050505] border-l border-white/[0.03]">
          {/* Result panel */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {result ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white/30 uppercase tracking-wider">Result</h3>
                  <span className="text-[10px] text-white/20 font-mono">{result.engine}</span>
                </div>

                <div className="bg-white/[0.02] border border-white/[0.03] rounded-2xl p-4 space-y-3">
                  <audio
                    controls
                    src={result.audioUrl}
                    className="w-full h-10 opacity-80 hover:opacity-100 transition-opacity"
                  />

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-white/5 rounded-lg px-3 py-2">
                      <div className="text-white/30 mb-0.5">Duration</div>
                      <div className="text-white/80 font-mono">{formatDuration(result.durationMs)}</div>
                    </div>
                    <div className="bg-white/5 rounded-lg px-3 py-2">
                      <div className="text-white/30 mb-0.5">Voice</div>
                      <div className="text-white/80 font-mono truncate" title={result.voiceId}>
                        {ALLOWED_VOICES.find((v) => v.id === result.voiceId)?.label || result.voiceId}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => downloadAudio(result.audioUrl, `nqh-voice-${result.id}.mp3`)}
                    className="w-full h-9 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white/70 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    Download
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-white/20 px-8 text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-40">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
                <p className="text-sm font-medium">Your synthesized audio will appear here</p>
                <p className="text-xs mt-1">Enter text and click Synthesize</p>
              </div>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="border-t border-white/[0.03] max-h-[40%] flex flex-col">
              <div className="px-4 py-3 border-b border-white/[0.03] flex items-center justify-between">
                <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-wider">History</h3>
                <button
                  onClick={() => setHistory([])}
                  className="text-[10px] text-white/20 hover:text-white/50 transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setResult(item)}
                    className="w-full text-left px-3 py-2 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-transparent hover:border-white/[0.03] transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20 group-hover:text-[#d9ff00] transition-colors flex-shrink-0">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-white/60 truncate">{item.text}</p>
                        <p className="text-[10px] text-white/20">
                          {formatDuration(item.durationMs)} · {ALLOWED_VOICES.find((v) => v.id === item.voiceId)?.label || item.voiceId}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
