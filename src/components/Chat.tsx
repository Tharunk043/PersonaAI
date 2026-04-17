import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, Volume2, Loader2, Mic, MicOff, Rocket, Copy, Check, X, ExternalLink, MessageSquare, Plus } from "lucide-react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { generateChatResponse, Message, ChatError } from "../services/groq";
import { TextToSpeech } from "../utils/textToSpeech";
import VoiceSettings from "./VoiceSettings";

import { API_BASE_URL as API_BASE } from "../config";
const MAX_INPUT_LENGTH = 500;

const cardVariant = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

type LocationState = { personaPrompt?: string; personaName?: string } | undefined;

interface ChatSession {
  id: string;
  persona_id?: string | null;
  title: string;
  persona_prompt?: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

interface StoredMessage extends Message {
  id?: string;
  created_at?: string;
}

type SRWindow = Window & {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
};

export const Chat: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { personaPrompt: initialPersonaPrompt, personaName: initialPersonaName } = (location.state as LocationState) || {};

  const [personaPrompt, setPersonaPrompt] = useState(initialPersonaPrompt || "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice (TTS)
  const [voiceMode, setVoiceMode] = useState(false); // when ON: TTS + mic
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("aura-luna-en");

  // Voice (STT via Web Speech API)
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [srSupported, setSrSupported] = useState<boolean>(true);
  const [srLanguage] = useState<string>("en-IN");
  const recognitionRef = useRef<any | null>(null);

  // 🔊 Track what we've already spoken to avoid repeats
  const lastSpokenIndexRef = useRef<number>(-1);

  // STT helpers for better silence handling
  const heardAnythingRef = useRef(false);
  const finalBufferRef = useRef<string>("");
  const silenceTimerRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const ttsRef = useRef<TextToSpeech | null>(null);

  // Title from personaPrompt
  const personaTitle = useMemo(() => {
    if (initialPersonaName) return initialPersonaName;
    if (!personaPrompt) return "AI Persona";
    const firstLine =
      personaPrompt.split("\n").find((l) => l.trim().length > 0) || "AI Persona";
    return firstLine.slice(0, 80);
  }, [personaPrompt, initialPersonaName]);

  // Deploy / share
  const [showDeploy, setShowDeploy] = useState(false);
  const [deployName, setDeployName] = useState("");
  const [deployDesc, setDeployDesc] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployedSlug, setDeployedSlug] = useState<string | null>(null);
  const [deployError, setDeployError] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  const deployedUrl = deployedSlug ? `${window.location.origin}/p/${deployedSlug}` : "";

  const authHeaders = () => {
    const token = localStorage.getItem("persona_token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const loadSessions = async () => {
    const res = await fetch(`${API_BASE}/api/chat-sessions?type=chat`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load chat sessions");
    setSessions(data.sessions || []);
    return data.sessions || [];
  };

  const loadSession = async (sessionId: string) => {
    setIsSessionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat-sessions/${sessionId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load chat session");

      setActiveSessionId(data.session.id);
      setPersonaPrompt(data.session.persona_prompt);
      setMessages((data.messages || []).map((m: StoredMessage) => ({ role: m.role, content: m.content })));
      setSearchParams({ session: String(data.session.id) }, { replace: true });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load chat session");
    } finally {
      setIsSessionLoading(false);
    }
  };

  const createSession = async (prompt: string, title = personaTitle) => {
    const res = await fetch(`${API_BASE}/api/chat-sessions`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ title, personaPrompt: prompt }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not create chat session");

    setActiveSessionId(data.session.id);
    setPersonaPrompt(data.session.persona_prompt);
    setMessages([]);
    setSearchParams({ session: String(data.session.id) }, { replace: true });
    await loadSessions();
    return data.session as ChatSession;
  };

  const persistMessage = async (sessionId: string, message: Message) => {
    const res = await fetch(`${API_BASE}/api/chat-sessions/${sessionId}/messages`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(message),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Could not save message");
    }
    await loadSessions();
  };

  const handleDeploy = async () => {
    if (!deployName.trim() || !personaPrompt) return;
    setDeploying(true);
    setDeployError("");
    try {
      const token = localStorage.getItem("persona_token");
      const res = await fetch(`${API_BASE}/api/personas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: deployName.trim(), prompt: personaPrompt, description: deployDesc.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setDeployError(data.error || "Deploy failed"); return; }
      setDeployedSlug(data.persona.slug);
    } catch {
      setDeployError("Network error. Is the server running?");
    } finally {
      setDeploying(false);
    }
  };

  const copyDeployLink = () => {
    navigator.clipboard.writeText(deployedUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Init TTS
  useEffect(() => {
    if (!ttsRef.current) {
      ttsRef.current = new TextToSpeech();
    }
    ttsRef.current.setVoice(selectedVoice);
  }, [selectedVoice]);

  // Load existing sessions or create a new saved session from the incoming persona prompt.
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setIsSessionLoading(true);
      try {
        const sessionIdFromUrl = searchParams.get("session");
        console.log("[Chat] Booting... URL session:", sessionIdFromUrl, "State prompt:", !!initialPersonaPrompt);

        if (initialPersonaPrompt) {
          console.log("[Chat] Initializing new session for:", initialPersonaName || "Persona");
          await createSession(initialPersonaPrompt, initialPersonaName || personaTitle);
          return;
        }

        const existingSessions = await loadSessions();
        if (sessionIdFromUrl) {
          await loadSession(sessionIdFromUrl);
          return;
        }

        if (existingSessions.length > 0) {
          await loadSession(existingSessions[0].id);
          return;
        }

        if (!cancelled) navigate("/profile", { replace: true });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load chats");
          if (!personaPrompt) navigate("/profile", { replace: true });
        }
      } finally {
        if (!cancelled) setIsSessionLoading(false);
      }
    };

    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPersonaPrompt]); // Re-run if a new prompt comes in via navigation state

  // Init SpeechRecognition with robust silence handling
  useEffect(() => {
    const W = window as SRWindow;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) {
      setSrSupported(false);
      return;
    }

    const rec = new SR();
    rec.lang = srLanguage;
    rec.interimResults = true;
    rec.continuous = true;      // we stop with a silence timer
    rec.maxAlternatives = 1;

    const clearSilenceTimer = () => {
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };

    const armSilenceTimer = () => {
      clearSilenceTimer();
      silenceTimerRef.current = window.setTimeout(() => {
        try { rec.stop(); } catch {}
      }, 1500);
    };

    rec.onstart = () => {
      setIsProcessing(false);
      setInterimText("");
      heardAnythingRef.current = false;
      finalBufferRef.current = "";
    };

    rec.onsoundstart = () => { heardAnythingRef.current = true; clearSilenceTimer(); };
    rec.onspeechstart = () => { heardAnythingRef.current = true; clearSilenceTimer(); };

    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const t = res[0].transcript;
        if (res.isFinal) finalBufferRef.current = (finalBufferRef.current + " " + t).trim();
        else interim += t;
      }
      setInterimText(interim);
      if (!interim) armSilenceTimer();
    };

    rec.onsoundend = () => { armSilenceTimer(); };

    rec.onerror = (e: any) => {
      const code = e?.error;
      if (code && code !== "no-speech" && code !== "aborted" && code !== "network") {
        setError(e?.message || "Voice recognition error.");
      }
      setIsListening(false);
      setIsProcessing(false);
      clearSilenceTimer();
    };

    rec.onend = () => {
      clearSilenceTimer();
      setIsListening(false);
      setIsProcessing(true);

      const text = (finalBufferRef.current || interimText).trim();
      setInterimText("");
      setIsProcessing(false);

      if (text) {
        retryCountRef.current = 0;
        handleSubmit(undefined, text);
        return;
      }

      if (!heardAnythingRef.current && retryCountRef.current < 1) {
        retryCountRef.current += 1;
        setTimeout(() => {
          try { rec.start(); setIsListening(true); } catch {}
        }, 150);
        return;
      }
    };

    recognitionRef.current = rec;
    return () => {
      try { recognitionRef.current?.abort?.(); } catch {}
      recognitionRef.current = null;
      clearSilenceTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srLanguage]);

  // Scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup TTS
  useEffect(() => {
    return () => {
      if (ttsRef.current) ttsRef.current.stop();
      try { recognitionRef.current?.abort?.(); } catch {}
    };
  }, []);

  // Textarea autoresize
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 160);
    el.style.height = next + "px";
  };

  // Play TTS
  const playMessage = (text: string) => {
    try {
      if (ttsRef.current) {
        ttsRef.current.speak(text);
        setIsPlaying(true);
      }
    } catch {
      setError("Failed to play audio. Please check your browser settings.");
      setIsPlaying(false);
    }
  };

  // Voice controls (TTS)
  const toggleVoiceMode = () => {
    setVoiceMode((prev) => {
      const next = !prev;
      if (prev && ttsRef.current) {
        ttsRef.current.stop();
        setIsPlaying(false);
      }
      return next;
    });
  };

  const handleVoiceChange = (voice: string) => {
    setSelectedVoice(voice);
    if (ttsRef.current) {
      ttsRef.current.setVoice(voice);
      if (isPlaying) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.role === "assistant") playMessage(lastMessage.content);
      }
    }
  };

  const togglePlayPause = () => {
    if (!ttsRef.current) return;
    if (ttsRef.current.isPlaying()) {
      ttsRef.current.pause();
      setIsPlaying(false);
    } else if (ttsRef.current.isPausedState()) {
      ttsRef.current.resume();
      setIsPlaying(true);
    } else {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "assistant") playMessage(lastMessage.content);
    }
  };

  // ✅ Auto-speak logic: whenever VoiceMode is ON, speak the latest assistant message once
  useEffect(() => {
    if (!voiceMode || !ttsRef.current || messages.length === 0) return;

    // find latest assistant message index
    let idx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") { idx = i; break; }
    }
    if (idx === -1) return;

    // avoid re-speaking the same message
    if (idx <= lastSpokenIndexRef.current) return;

    playMessage(messages[idx].content);
    lastSpokenIndexRef.current = idx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, voiceMode]);

  // Send (typed or voice text)
  const handleSubmit = async (e?: React.FormEvent, voiceInput?: string) => {
    if (e) e.preventDefault();
    const content = (voiceInput ?? inputMessage).trim();
    if (!content || isLoading || isSessionLoading) return;

    const prompt = personaPrompt || initialPersonaPrompt;
    if (!prompt) {
      setError("Create or open a persona before chatting.");
      return;
    }

    if (content.length > MAX_INPUT_LENGTH) {
      setError(`Message too long. Please keep it under ${MAX_INPUT_LENGTH} characters.`);
      return;
    }

    setInputMessage("");
    autoResize();
    setError(null);

    const userMsg: Message = { role: "user", content };
    const nextHistory: Message[] = [...messages, userMsg];

    setMessages(nextHistory);
    setIsLoading(true);

    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        const created = await createSession(prompt, personaTitle);
        sessionId = created.id;
        setMessages(nextHistory);
      }

      await persistMessage(sessionId, userMsg);

      const response = await generateChatResponse(prompt, nextHistory, content);
      const assistantMsg = { role: "assistant" as const, content: response };
      setMessages((prev) => [...prev, assistantMsg]);
      await persistMessage(sessionId, assistantMsg);

      // ❌ remove direct play here; the auto-speak effect above will handle it
      // if (voiceMode && ttsRef.current) { playMessage(response); }
    } catch (err) {
      const errorMessage =
        err instanceof ChatError ? err.message : "An unexpected error occurred. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const disabledSend = isLoading || isSessionLoading || inputMessage.trim().length === 0;

  // Send on Enter, newline on Shift+Enter
  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabledSend) handleSubmit();
    }
  };

  // STT controls
  const startListening = () => {
    if (!srSupported) {
      setError("Your browser doesn’t support Speech Recognition. Try Chrome or Edge.");
      return;
    }
    if (!recognitionRef.current) {
      setError("Speech Recognition not initialized.");
      return;
    }
    setIsListening(true);
    setIsProcessing(false);
    setInterimText("");
    heardAnythingRef.current = false;
    finalBufferRef.current = "";
    retryCountRef.current = 0;

    try {
      recognitionRef.current.lang = srLanguage;
      recognitionRef.current.start();
    } catch {
      setError("Microphone is busy. Please try again.");
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <div className="shadow-sm border-b border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/profile")}
            className="inline-flex items-center gap-2 text-gray-900 dark:text-gray-100 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>

          <div className="flex-1 min-w-0 text-center">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold">
                AI
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold truncate max-w-[48ch]">
                  {personaTitle}
                </div>
                <div className="text-[11px] opacity-90">Persona chat</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowDeploy(true); setDeployName(personaTitle); }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2 text-xs font-semibold text-white shadow transition hover:shadow-md"
              title="Deploy & get shareable link"
            >
              <Rocket className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Deploy</span>
            </button>
            <VoiceSettings
              voiceMode={voiceMode}
              isPlaying={isPlaying}
              selectedVoice={selectedVoice}
              onVoiceModeToggle={toggleVoiceMode}
              onPlayPauseToggle={togglePlayPause}
              onVoiceChange={handleVoiceChange}
            />
          </div>
        </div>
      </div>

      {/* Deploy Modal */}
      <AnimatePresence>
        {showDeploy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowDeploy(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900"
            >
              {!deployedSlug ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Rocket className="h-5 w-5 text-emerald-500" />
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Deploy Persona</h3>
                    </div>
                    <button onClick={() => setShowDeploy(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Save this persona and get a shareable link anyone can use to chat with it.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Persona Name</label>
                      <input
                        type="text"
                        value={deployName}
                        onChange={(e) => setDeployName(e.target.value)}
                        maxLength={100}
                        placeholder="My Awesome Persona"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
                      <textarea
                        value={deployDesc}
                        onChange={(e) => setDeployDesc(e.target.value)}
                        maxLength={500}
                        rows={2}
                        placeholder="A brief description of what this persona does…"
                        className="w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                    {deployError && (
                      <p className="text-sm text-red-500">{deployError}</p>
                    )}
                    <button
                      onClick={handleDeploy}
                      disabled={deploying || !deployName.trim()}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-sm font-semibold text-white shadow transition hover:shadow-md disabled:opacity-50"
                    >
                      {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                      {deploying ? "Deploying…" : "Deploy & Get Link"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                        <Check className="h-4 w-4 text-emerald-600" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Deployed!</h3>
                    </div>
                    <button onClick={() => { setShowDeploy(false); setDeployedSlug(null); }} className="text-gray-400 hover:text-gray-600">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Your persona is live! Share this link with anyone:
                  </p>
                  <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                    <input
                      type="text"
                      readOnly
                      value={deployedUrl}
                      className="flex-1 bg-transparent text-sm font-mono text-indigo-600 dark:text-indigo-400 outline-none"
                    />
                    <button
                      onClick={copyDeployLink}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                    >
                      {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {linkCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <a
                      href={deployedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open Link
                    </a>
                    <button
                      onClick={() => { setShowDeploy(false); setDeployedSlug(null); }}
                      className="flex-1 rounded-xl bg-gray-900 py-2 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-gray-700"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat container */}
      <div className="max-w-6xl mx-auto px-4 py-6 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-gray-200/70 bg-white p-4 shadow dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
              <MessageSquare className="h-4 w-4" />
              Sessions
            </div>
            <button
              onClick={() => navigate("/profile")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700"
              title="Create a new persona chat"
              aria-label="Create a new persona chat"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 max-h-[68vh] space-y-2 overflow-y-auto pr-1">
            {isSessionLoading && sessions.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading chats
              </div>
            ) : sessions.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                Saved chats will appear here.
              </p>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={[
                    "w-full rounded-xl px-3 py-2 text-left text-sm transition",
                    activeSessionId === session.id
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
                  ].join(" ")}
                >
                  <span className="block truncate font-medium">{session.title}</span>
                  <span className={activeSessionId === session.id ? "text-xs text-indigo-100" : "text-xs text-gray-400"}>
                    {session.message_count || 0} messages
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <motion.div
          variants={cardVariant}
          initial="hidden"
          animate="show"
          className="rounded-3xl overflow-hidden border border-gray-200/70 dark:border-gray-800 bg-white dark:bg-gray-900 shadow"
        >
          {/* Messages */}
          <div className="h-[70vh] overflow-y-auto p-5 sm:p-6 space-y-4">
            {isSessionLoading && (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400">
                <Loader2 className="mb-3 h-6 w-6 animate-spin text-indigo-500" />
                <div className="font-medium">Loading saved chat</div>
              </div>
            )}

            {messages.length === 0 && !isLoading && !isSessionLoading && !error && (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <Send className="w-5 h-5" />
                </div>
                <div className="font-medium">Start the conversation</div>
                <div className="text-sm mt-1">
                  Type or use the mic. With Voice Mode ON, replies are spoken out too.
                </div>
              </div>
            )}

            {messages.map((message, index) => {
              const isUser = message.role === "user";
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex items-end gap-2 max-w-[85%]`}>
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                        AI
                      </div>
                    )}
                    <div
                      className={[
                        "rounded-2xl px-4 py-3 text-sm leading-6",
                        isUser
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800",
                      ].join(" ")}
                    >
                      {message.content}
                      {!isUser && voiceMode && (
                        <button
                          onClick={() => playMessage(message.content)}
                          className="ml-2 align-middle inline-flex text-indigo-50 dark:text-indigo-300/90 hover:opacity-80"
                          aria-label="Play message"
                          title="Play message"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {isUser && (
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center justify-center text-[10px] font-bold">
                        You
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 text-sm bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Typing…
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-center">
                <div
                  className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-2 text-sm text-red-700 dark:text-red-300"
                  role="alert"
                >
                  {error}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-gray-200/70 dark:border-gray-800"
          >
            <div className="p-3 sm:p-4">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e) => {
                      if (e.target.value.length <= MAX_INPUT_LENGTH) {
                        setInputMessage(e.target.value);
                        autoResize();
                      }
                    }}
                    onInput={autoResize}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Type your message… (Shift+Enter for new line)"
                    className="w-full resize-none px-4 py-3 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 focus:border-transparent"
                  />
                  <div className="absolute right-3 bottom-2 text-[11px] text-gray-400">
                    {inputMessage.length}/{MAX_INPUT_LENGTH}
                  </div>
                </div>

                {/* Built-in mic button (Web Speech API) */}
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  disabled={isLoading || isSessionLoading || isProcessing || !srSupported}
                  className={[
                    "h-11 px-3 rounded-2xl inline-flex items-center justify-center gap-2 transition-colors",
                    isLoading || isSessionLoading || isProcessing || !srSupported
                      ? "opacity-50 cursor-not-allowed bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                      : isListening
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-gray-900 hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 text-white",
                  ].join(" ")}
                  title={
                    !srSupported
                      ? "Speech Recognition unsupported in this browser"
                      : isListening
                      ? "Stop listening"
                      : "Start voice input"
                  }
                  aria-pressed={isListening}
                  aria-label="Voice input"
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isListening ? (
                    <>
                      <MicOff className="w-5 h-5" />
                      <span className="hidden sm:inline">Stop</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5" />
                      <span className="hidden sm:inline">Speak</span>
                    </>
                  )}
                  {isListening && (
                    <span className="ml-2 text-xs opacity-80">Listening… pause to auto-stop</span>
                  )}
                </button>

                <button
                  type="submit"
                  disabled={disabledSend}
                  className="h-11 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Send message"
                  title="Send"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>
                  Press <kbd className="px-1 py-0.5 rounded border">Enter</kbd> to send •{" "}
                  <kbd className="px-1 py-0.5 rounded border">Shift</kbd> +{" "}
                  <kbd className="px-1 py-0.5 rounded border">Enter</kbd> for a new line
                </span>
                <span>{voiceMode ? "Voice mode is ON (TTS + Mic)" : "Voice mode is OFF"}</span>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default Chat;
