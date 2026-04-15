import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * CreativeHelper.tsx (Web keywords + HeyGen-ready)
 * ------------------------------------------------------------
 * Supports providers that either:
 *  - return { jobId } (polling flow — e.g., HeyGen), or
 *  - return { status:"succeeded", url } immediately (web keywords demo).
 */

// ---------- Small helpers ----------
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const fmtPct = (n?: number) => (typeof n === "number" ? `${clamp(Math.round(n))}%` : "—");

// ---------- Types shared with your API ----------
export type Provider =
  | "web"        // NEW: keyword-based CC0 clip (immediate)
  | "heygen"     // HeyGen talking avatar
  | "veo"        // Google Veo (Vertex)
  | "luma"
  | "pika"
  | "runway"
  | "demo";      // Server demo shortcut

export interface CreateJobRequest {
  prompt: string;
  provider: Provider;
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3";
  durationSeconds?: number;
  guidanceScale?: number;
  seed?: number;
}

export type CreateJobResponse =
  | { jobId: string }
  | { status: "queued" | "running" | "succeeded" | "failed"; url?: string; message?: string };

export interface JobStatusResponse {
  status: "queued" | "running" | "succeeded" | "failed";
  url?: string;
  thumb?: string;
  progress?: number;
  message?: string;
}

// ---------- The Page Component ----------
export default function CreativeHelper() {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<Provider>("web"); // default to WEB keywords
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1" | "4:3">("16:9");
  const [durationSeconds, setDurationSeconds] = useState<number>(8);
  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canSubmit = useMemo(() => prompt.trim().length > 4 && !submitting, [prompt, submitting]);

  // Polling loop for status (used when backend returns a jobId)
  useEffect(() => {
    if (!jobId) return;

    let active = true;
    let timer: number | null = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/generate-video?jobId=${encodeURIComponent(jobId)}`);
        if (!res.ok) throw new Error(`Status HTTP ${res.status}`);
        const body: JobStatusResponse = await res.json();
        if (!active) return;
        setStatus(body);

        if (body.status === "succeeded" || body.status === "failed") {
          timer && window.clearTimeout(timer);
          return;
        }
        timer = window.setTimeout(poll, 1600);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message ?? "Failed to poll status");
        timer && window.clearTimeout(timer);
      }
    };

    poll();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [jobId]);

  const startGeneration = async () => {
    setSubmitting(true);
    setError(null);
    setStatus(null);
    setJobId(null);

    try {
      const payload: CreateJobRequest = {
        prompt: prompt.trim(),
        provider,          // ← use the selected provider (web/heygen/demo/etc.)
        aspectRatio,
        durationSeconds,
      };

      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Create job HTTP ${res.status}`);
      const data: CreateJobResponse = await res.json();

      // Handle both immediate-success (web/demo) and job-based (heygen/…)
      if ("status" in data && data.status === "succeeded" && data.url) {
        setStatus({ status: "succeeded", url: data.url, progress: 100, message: data.message });
        setJobId(null);
      } else if ("jobId" in data && data.jobId) {
        setJobId(data.jobId);
      } else {
        throw new Error((data as any)?.message || "Unexpected response from API");
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to start generation");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelJob = async () => {
    if (!jobId) return;
    try {
      await fetch(`/api/generate-video?jobId=${encodeURIComponent(jobId)}`, { method: "DELETE" });
    } catch {
      // no-op
    } finally {
      setJobId(null);
      setStatus(null);
    }
  };

  const videoReady = status?.status === "succeeded" && !!status.url;
  const isRunning = status?.status === "queued" || status?.status === "running";

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 px-4 sm:px-6 lg:px-8 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Creative Helper</h1>
            <p className="text-sm text-neutral-400 mt-1">
              Type a scene (or script) and I’ll fetch a free clip (Web) or generate a video (HeyGen).
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-800 px-3 py-1">
              🔑 Server-side API required (for HeyGen etc.)
            </span>
          </div>
        </header>

        {/* Card */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 shadow-xl backdrop-blur p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
            {/* Left: Controls */}
            <div className="lg:col-span-2 space-y-4">
              <label className="block text-sm font-medium">Describe your scene or script</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder='e.g., "ocean waves at sunset" or "city street at night with neon"'
                className="w-full h-40 resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-medium">Provider</label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as Provider)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2"
                  >
                    <option value="web">Web (free keywords)</option>
                    <option value="heygen">HeyGen (Talking avatar)</option>
                    <option value="veo">Google Veo (Gemini video)</option>
                    <option value="luma">Luma</option>
                    <option value="pika">Pika</option>
                    <option value="runway">Runway</option>
                    <option value="demo">Demo (server fallback)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium">Aspect ratio</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value as any)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2"
                  >
                    <option value="16:9">16:9 (landscape)</option>
                    <option value="9:16">9:16 (vertical)</option>
                    <option value="1:1">1:1 (square)</option>
                    <option value="4:3">4:3</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs text-neutral-300 hover:text-white underline underline-offset-4"
              >
                {showAdvanced ? "Hide" : "Show"} advanced
              </button>

              {showAdvanced && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-sm font-medium">Duration (s)</label>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={durationSeconds}
                      onChange={(e) => setDurationSeconds(parseInt(e.target.value || "8", 10))}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2"
                    />
                  </div>
                  <div className="opacity-70">
                    <label className="block text-sm font-medium">Seed (optional)</label>
                    <input
                      disabled
                      placeholder="Provider-specific"
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  disabled={!canSubmit}
                  onClick={startGeneration}
                  className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium shadow-md transition ${
                    canSubmit ? "bg-indigo-600 hover:bg-indigo-500" : "bg-neutral-700 cursor-not-allowed"
                  }`}
                >
                  {submitting ? "Starting…" : "Generate video"}
                </button>
                {isRunning && (
                  <button
                    onClick={cancelJob}
                    className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium bg-neutral-800 hover:bg-neutral-700"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Status area */}
              <div className="mt-4 text-sm">
                {error && (
                  <div className="mb-2 rounded-lg border border-red-900/40 bg-red-950/40 p-3 text-red-200">
                    ❌ {error}
                  </div>
                )}
                {status && (
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                    <div className="flex items-center justify-between text-neutral-300">
                      <span>
                        Status: <span className="font-semibold text-white">{status.status}</span>
                      </span>
                      <span>
                        Progress: <span className="font-semibold text-white">{fmtPct(status.progress)}</span>
                      </span>
                    </div>
                    {status.message && <p className="mt-1 text-neutral-400 text-xs">{status.message}</p>}
                    <div className="mt-3 h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
                      <div className="h-full bg-indigo-500 transition-all" style={{ width: `${clamp(status.progress ?? 0)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Preview */}
            <div className="lg:col-span-3">
              <div className="aspect-video w-full overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 relative">
                {!videoReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-400 p-6 text-center">
                    {status?.thumb ? (
                      <img src={status.thumb} alt="preview" className="h-full w-full object-cover" />
                    ) : (
                      <>
                        <span className="text-6xl">🎬</span>
                        <p className="max-w-md">
                          Your video preview appears here. Try keywords like <em>ocean</em>, <em>city</em>, <em>forest</em>,
                          <em> fire</em>, <em>tech</em>.
                        </p>
                      </>
                    )}
                  </div>
                )}

                {videoReady && (
                  <video
                    ref={videoRef}
                    className="h-full w-full object-contain bg-black"
                    src={status!.url}
                    controls
                    playsInline
                  />
                )}
              </div>

              {videoReady && (
                <div className="mt-3 flex items-center gap-3">
                  <a href={status!.url} download className="rounded-xl bg-neutral-800 hover:bg-neutral-700 px-4 py-2 text-sm">
                    Download
                  </a>
                  <button
                    className="rounded-xl bg-neutral-800 hover:bg-neutral-700 px-4 py-2 text-sm"
                    onClick={() => videoRef.current?.play()}
                  >
                    ▶︎ Play
                  </button>
                  <button
                    className="rounded-xl bg-neutral-800 hover:bg-neutral-700 px-4 py-2 text-sm"
                    onClick={() => videoRef.current?.pause()}
                  >
                    ❚❚ Pause
                  </button>
                </div>
              )}

              {/* Tips */}
              <div className="mt-6 text-xs text-neutral-400 space-y-1">
                <p>Tip: Try descriptive keywords for the Web provider (e.g., “ocean at sunset”, “city at night”, “forest rain”).</p>
                <p>Switch provider to HeyGen to generate a talking avatar using your script.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-6 text-xs text-neutral-500">
          Note: Providers enforce safety filters and generation limits. The exact duration, resolution, and motion fidelity
          depend on your chosen model and account plan.
        </p>
      </div>
    </div>
  );
}
