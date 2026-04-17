import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Send, Loader2, Sparkles, Copy, Check } from "lucide-react";
import { useParams } from "react-router-dom";
import { generateChatResponse, Message, ChatError } from "../services/groq";

import { API_BASE_URL as API_BASE } from "../config";

interface PersonaData {
  slug: string;
  name: string;
  prompt: string;
  description: string;
  creator_name: string;
  created_at: string;
}

const SharedPersona: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [persona, setPersona] = useState<PersonaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch persona on mount
  useEffect(() => {
    if (!slug) return;
    fetch(`${API_BASE}/api/personas/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setPersona(data.persona))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputMessage.trim();
    if (!content || isSending || !persona) return;

    setInputMessage("");
    setError(null);

    const userMsg: Message = { role: "user", content };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setIsSending(true);

    try {
      const response = await generateChatResponse(persona.prompt, nextHistory, content);
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch (err) {
      setError(err instanceof ChatError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // Not found
  if (notFound || !persona) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-gray-950 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <Sparkles className="mx-auto mb-4 h-10 w-10 text-slate-400" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Persona Not Found</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">This persona link may be invalid or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <div className="border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-gray-800/70 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white">{persona.name}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                by {persona.creator_name} · Shared Persona
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-slate-300"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        </div>
      </div>

      {/* Persona info banner */}
      {persona.description && (
        <div className="mx-auto w-full max-w-4xl px-4 pt-4">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-sm text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/5 dark:text-indigo-300">
            {persona.description}
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-4">
        <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
          <div className="space-y-4">
            {messages.length === 0 && !isSending && (
              <div className="flex h-60 flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500">
                <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40">
                  <Sparkles className="h-6 w-6 text-indigo-500" />
                </div>
                <p className="font-medium text-slate-600 dark:text-slate-300">Chat with {persona.name}</p>
                <p className="mt-1 text-sm">Type a message below to start the conversation.</p>
              </div>
            )}

            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex max-w-[85%] items-end gap-2`}>
                    {!isUser && (
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[10px] font-bold text-white">
                        AI
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        isUser
                          ? "bg-indigo-600 text-white"
                          : "border border-slate-200 bg-slate-50 text-slate-800 dark:border-gray-700 dark:bg-gray-800 dark:text-slate-200"
                      }`}
                    >
                      {msg.content}
                    </div>
                    {isUser && (
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 dark:bg-gray-700 dark:text-slate-300">
                        You
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {isSending && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                  <span className="text-slate-500">Typing…</span>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="mt-3 flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              autoResize();
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Type your message…"
            className="flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-indigo-500 dark:focus:ring-indigo-800"
          />
          <button
            type="submit"
            disabled={isSending || !inputMessage.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </form>

        <p className="mt-2 text-center text-[11px] text-slate-400">
          Powered by <span className="font-semibold">Persona Studio</span> · <a href="/" className="underline">Create your own</a>
        </p>
      </div>
    </div>
  );
};

export default SharedPersona;
