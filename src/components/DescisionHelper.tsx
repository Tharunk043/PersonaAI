import React, { useEffect, useMemo, useRef, useState } from "react";
import { generateChatResponse } from "../services/groq";

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  ts: number;
};

type RecogStatus = "idle" | "listening" | "unsupported" | "denied" | "error";

const DecisionHelper: React.FC = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  // Voice state
  const [recogStatus, setRecogStatus] = useState<RecogStatus>("idle");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [lang, setLang] = useState("en-IN");
  const [interim, setInterim] = useState(""); // live speech preview (not committed)

  const listRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const inputAtStartRef = useRef<string>(""); // snapshot of input when mic starts
  const finalRef = useRef<string>("");        // accumulated final transcript only
  const lastSpokenId = useRef<string | null>(null);

  const hasUserMessage = useMemo(
    () => messages.some((m) => m.role === "user"),
    [messages]
  );

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // ---- SpeechRecognition (no duplicates) ----
  useEffect(() => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setRecogStatus("unsupported");
      return;
    }
    const recog = new SR();
    recog.continuous = false;        // single utterance
    recog.interimResults = true;     // show interim separately
    recog.lang = lang;
    recog.maxAlternatives = 1;

    recognitionRef.current = recog;

    recog.onstart = () => {
      setRecogStatus("listening");
      setInterim("");
      finalRef.current = "";
      inputAtStartRef.current = input;   // snapshot
    };

    recog.onend = () => {
      // commit the final transcript only (no interims)
      const committed = (inputAtStartRef.current + " " + finalRef.current).trim();
      setInput(committed);
      setInterim("");
      setRecogStatus("idle");
    };

    recog.onerror = (e: any) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") setRecogStatus("denied");
      else setRecogStatus("error");
    };

    recog.onresult = (event: any) => {
      // Build final-only string and the latest interim preview
      let latestInterim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const seg = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) {
          finalRef.current += (finalRef.current ? " " : "") + seg.trim();
        } else {
          latestInterim = seg.trim();
        }
      }
      // Update interim preview (not the input)
      setInterim(latestInterim);
      // Live committed text preview (final only)
      const previewCommitted = (inputAtStartRef.current + " " + finalRef.current).trim();
      setInput(previewCommitted);
    };

    return () => {
      try { recog.stop(); } catch {}
    };
  }, [lang, input]);

  // Auto TTS: speak the latest assistant message when it appears
  useEffect(() => {
    if (!autoSpeak) {
      window.speechSynthesis?.cancel();
      return;
    }
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (last?.content && last.id !== lastSpokenId.current) {
      lastSpokenId.current = last.id;
      speak(last.content, lang);
    }
  }, [messages, autoSpeak, lang]);

  const send = async (prompt?: string) => {
    const clean = (prompt ?? input).replace(/\s+/g, " ").trim();
    if (!clean || loading) return;

    // prevent accidental duplicate consecutive sends
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser && lastUser.content === clean && Date.now() - lastUser.ts < 2500) {
      return; // ignore duplicate within 2.5s
    }

    setErr("");
    setLatencyMs(null);

    const umsg: ChatMsg = { id: rid(), role: "user", content: clean, ts: Date.now() };
    setMessages((m) => [...m, umsg]);
    setInput("");
    setInterim("");
    setLoading(true);

    const t0 = performance.now();

    try {
      const systemPrompt = "You are an analytical and concise Decision Helper AI. Help the user carefully weigh options to make the best decision.";
      const groqHistory = messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
      
      const answer = await generateChatResponse(systemPrompt, groqHistory, clean);

      const t1 = performance.now();
      setLatencyMs(Math.max(0, Math.round(t1 - t0)));

      const amsg: ChatMsg = { id: rid(), role: "assistant", content: answer, model: "groq-llama", ts: Date.now() };
      setMessages((m) => [...m, amsg]);
    } catch (e) {
      let msg = "Request failed";
      if (e instanceof Error) msg = e.message;
      else if (typeof e === "string") msg = e;
      setErr(msg);

      // only add an error bubble if there is at least one user message
      setMessages((m) => {
        const hasUser = m.some((mm) => mm.role === "user");
        if (!hasUser) return m; // keep suggestions visible on startup
        return [...m, { id: rid(), role: "assistant", content: `⚠️ ${msg}`, ts: Date.now() }];
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const toggleMic = () => {
    const recog = recognitionRef.current;
    if (!recog) return;
    if (recogStatus === "listening") {
      try { recog.stop(); } catch {}
      return;
    }
    try {
      recog.lang = lang;
      setInterim("");
      finalRef.current = "";
      inputAtStartRef.current = input;
      recog.start();
    } catch {
      setRecogStatus("error");
    }
  };

  const headerModel = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    return lastAssistant?.model ?? "Decision Helper AI";
  }, [messages]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-gray-950 dark:to-gray-900 text-gray-900 dark:text-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-black/5 dark:border-white/10 bg-white/70 dark:bg-gray-950/60 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white font-semibold">AI</span>
            <div className="leading-tight">
              <div className="font-semibold">Decision Helper</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{headerModel}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="text-xs rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-gray-950 px-2 py-1"
              title="Speech language"
            >
              <option value="en-IN">English (India)</option>
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="hi-IN">Hindi (India)</option>
              <option value="te-IN">Telugu (India)</option>
              <option value="ta-IN">Tamil (India)</option>
            </select>
            {latencyMs != null && (
              <span className="text-xs px-2 py-1 rounded-md bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
                {latencyMs} ms
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Suggestions (visible until first user message) */}
      {!hasUserMessage && !loading && (
        <div className="max-w-4xl mx-auto px-4 pt-8 grid sm:grid-cols-2 gap-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-left rounded-2xl border border-black/5 dark:border-white/10 p-4 bg-white dark:bg-gray-950 hover:bg-blue-50/60 dark:hover:bg-blue-950/20 transition"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Chat */}
      <main className="max-w-4xl mx-auto w-full px-4 flex-1">
        <div ref={listRef} className="w-full h-full max-h-[calc(100vh-300px)] overflow-y-auto pt-4">
          {messages.map((m) => <ChatBubble key={m.id} msg={m} />)}
          {loading && <TypingBubble />}
        </div>
        {err && (
          <div className="mt-3 text-sm rounded-xl border border-red-300/60 text-red-800 bg-red-50 p-3 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800/40">
            {err}
          </div>
        )}
      </main>

      {/* Composer */}
      <footer className="w-full border-t border-black/5 dark:border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-gray-950 p-2">
            <div className="flex items-start gap-2">
              {/* Text Input */}
              <div className="flex-1">
                <textarea
                  className="w-full resize-none bg-transparent outline-none p-3 rounded-xl min-h-[72px] max-h-[240px]"
                  placeholder="Speak or type your question… (Shift+Enter for new line)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                {/* Interim speech preview */}
                {!!interim && (
                  <div className="px-3 pb-2 text-xs text-gray-500 dark:text-gray-400 italic">
                    🎤 {interim}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col items-center gap-2 pr-2 pt-2">
                {/* Mic Button (icon) */}
                <button
                  onClick={toggleMic}
                  disabled={recogStatus === "unsupported"}
                  className={`flex items-center justify-center h-10 w-10 rounded-full border transition-all duration-200
                    ${recogStatus === "listening"
                      ? "bg-red-600 text-white border-red-700 animate-pulse"
                      : "bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border-black/10 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                  title={
                    recogStatus === "unsupported"
                      ? "Speech recognition not supported"
                      : recogStatus === "listening"
                      ? "Stop listening"
                      : "Start voice input"
                  }
                >
                  <MicIcon
                    className={`h-5 w-5 ${
                      recogStatus === "listening"
                        ? "fill-white"
                        : "fill-gray-600 dark:fill-gray-300"
                    }`}
                  />
                </button>

                {/* Send Button */}
                <button
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                  className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {loading ? "Thinking…" : "Send"}
                </button>

                {/* TTS Toggle */}
                <label className="text-[11px] flex items-center gap-2 px-1">
                  <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} />
                  Read aloud
                </label>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
            {recogStatus === "unsupported" && "Voice input not supported in this browser. Try Chrome/Edge."}
            {recogStatus === "denied" && "Microphone permission denied. Enable microphone in browser settings."}
            {recogStatus === "error" && "An error occurred with microphone. Try again."}
            {recogStatus === "listening" && "Listening… speak now."}
          </div>
        </div>
      </footer>
    </div>
  );
};

/* -------- components & utils -------- */

const ChatBubble: React.FC<{ msg: ChatMsg }> = ({ msg }) => {
  const isUser = msg.role === "user";
  const copy = async () => { try { await navigator.clipboard.writeText(msg.content); } catch {} };
  return (
    <div className={`w-full my-2 flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[90%] sm:max-w-[75%] rounded-2xl p-3 shadow-sm border
        ${isUser ? "bg-blue-600 text-white border-blue-700"
                 : "bg-white dark:bg-gray-950 border-black/5 dark:border-white/10"}`}>
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className={`text-xs ${isUser ? "text-blue-50/90" : "text-gray-500 dark:text-gray-400"}`}>
            {isUser ? "You" : "Assistant"}
          </span>
          <div className="flex items-center gap-2">
            {!isUser && msg.model && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300 border border-black/5 dark:border-white/10">
                {msg.model}
              </span>
            )}
            <button onClick={copy} title="Copy"
              className={`text-[11px] px-2 py-0.5 rounded border ${
                isUser ? "border-blue-400/60 hover:bg-blue-500/30"
                       : "border-black/10 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-gray-900"}`}>
              Copy
            </button>
          </div>
        </div>
        <div className={`prose prose-sm max-w-none ${isUser ? "prose-invert" : ""} dark:prose-invert`}>
          <pre className={`whitespace-pre-wrap break-words font-sans leading-relaxed ${isUser ? "text-white" : "text-gray-900 dark:text-gray-100"}`}>
            {msg.content}
          </pre>
        </div>
        <div className={`mt-1 text-[10px] ${isUser ? "text-blue-50/70" : "text-gray-400 dark:text-gray-500"}`}>
          {new Date(msg.ts).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

const TypingBubble: React.FC = () => (
  <div className="w-full my-2 flex justify-start">
    <div className="max-w-[75%] rounded-2xl p-3 border bg-white dark:bg-gray-950 border-black/5 dark:border-white/10">
      <span className="text-xs text-gray-500 dark:text-gray-400">Assistant</span>
      <div className="mt-1 flex items-center gap-1">
        <Dot /><Dot style={{ animationDelay: "120ms" }} /><Dot style={{ animationDelay: "240ms" }} />
      </div>
    </div>
  </div>
);

const Dot: React.FC<React.HTMLAttributes<HTMLSpanElement>> = (props) => (
  <span {...props} className="inline-block h-2 w-2 rounded-full bg-gray-400/80 dark:bg-gray-500/80 animate-bounce" />
);

const SUGGESTIONS = [
  "I have two job offers; which should I pick?",
  "Buy or rent a laptop for 6 months?",
  "Is it worth doing a weekend road trip from Hyderabad to Goa?",
  "Should I take an online course or learn via projects?",
];

const rid = () => {
  const a = new Uint32Array(1);
  (crypto || (window as any).crypto).getRandomValues(a);
  return `${Date.now().toString(36)}_${a[0].toString(36)}`;
};

function speak(text: string, lang = "en-IN") {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    utt.rate = 1;
    utt.pitch = 1;
    synth.speak(utt);
  } catch {}
}

const MicIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
    <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a1 1 0 0 1 2 0 7 7 0 0 1-6 6.93V21h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-3.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0Z" />
  </svg>
);

export default DecisionHelper;
