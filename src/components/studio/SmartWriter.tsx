import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, PenLine, Copy, Check, RefreshCw, Sparkles, FileText, Loader2 } from 'lucide-react';
import { generateChatResponse } from '../../services/groq';

const CONTENT_TYPES = [
  { id: 'email', label: 'Email', emoji: '📧' },
  { id: 'tweet', label: 'Tweet / X Post', emoji: '🐦' },
  { id: 'blog', label: 'Blog Intro', emoji: '📝' },
  { id: 'linkedin', label: 'LinkedIn Post', emoji: '💼' },
  { id: 'essay', label: 'Essay Paragraph', emoji: '📖' },
  { id: 'code-comment', label: 'Code Comment', emoji: '💻' },
  { id: 'caption', label: 'Social Caption', emoji: '📸' },
  { id: 'summary', label: 'Summary', emoji: '📋' },
];

const TONES = [
  { id: 'professional', label: 'Professional', color: 'from-blue-500 to-cyan-500' },
  { id: 'casual', label: 'Casual', color: 'from-green-500 to-emerald-500' },
  { id: 'funny', label: 'Funny', color: 'from-yellow-500 to-orange-500' },
  { id: 'academic', label: 'Academic', color: 'from-purple-500 to-indigo-500' },
  { id: 'poetic', label: 'Poetic', color: 'from-pink-500 to-rose-500' },
  { id: 'persuasive', label: 'Persuasive', color: 'from-red-500 to-orange-500' },
];

const SmartWriter: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [personaName, setPersonaName] = useState('');
  const [contentType, setContentType] = useState('email');
  const [tone, setTone] = useState('professional');
  const [topic, setTopic] = useState('');
  const [result, setResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const wordCount = result.trim() ? result.trim().split(/\s+/).length : 0;
  const charCount = result.length;

  const getContentTypeLabel = () => CONTENT_TYPES.find(c => c.id === contentType)?.label || contentType;
  const getToneLabel = () => TONES.find(t => t.id === tone)?.label || tone;

  const generateContent = useCallback(async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setResult('');
    setError('');
    setCopied(false);

    const persona = personaName.trim() || 'a skilled writer';
    const contentLabel = getContentTypeLabel();
    const toneLabel = getToneLabel();

    const lengthGuide: Record<string, string> = {
      'email': '100-200 words, with a proper greeting and sign-off',
      'tweet': 'under 280 characters, punchy and impactful',
      'blog': '150-250 words, with a strong hook in the first sentence',
      'linkedin': '100-200 words, engaging and thought-provoking with relevant hashtags',
      'essay': '150-250 words, well-structured with a clear thesis',
      'code-comment': '2-5 lines of clear, concise documentation-style comments',
      'caption': '1-3 sentences, catchy and relatable',
      'summary': '100-150 words, capturing the key points concisely',
    };

    const prompt = `You are an AI content writer completely embodying the persona of ${persona}.

Write a ${contentLabel} in a ${toneLabel.toLowerCase()} tone about the following topic/instructions:

"${topic}"

Guidelines:
- Length: ${lengthGuide[contentType] || '100-200 words'}
- Write ENTIRELY in character as ${persona}
- Match the ${toneLabel.toLowerCase()} tone perfectly
- Make it polished, engaging, and ready to use
- Do NOT include any meta-commentary, explanations, or markdown formatting
- Just output the content directly, ready to copy-paste`;

    try {
      const response = await generateChatResponse(prompt, [], "Generate the content now.");
      setResult(response);
    } catch (err) {
      setError("Generation failed. Please check your API connection and try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [personaName, contentType, tone, topic]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = result;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const regenerate = () => {
    generateContent();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col py-8 px-4 items-center">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Studio
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-xl shadow-lg shadow-orange-500/20">
            <PenLine className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">AI Smart Writer</h1>
            <p className="text-slate-400 text-sm">Generate polished content in any persona's voice, instantly.</p>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {/* Persona Name */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Write as... <span className="text-slate-600">(persona)</span>
            </label>
            <input
              type="text"
              value={personaName}
              onChange={(e) => setPersonaName(e.target.value)}
              placeholder="e.g. Steve Jobs, Shakespeare, a Gen-Z influencer..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-amber-500 outline-none transition-colors placeholder-slate-600"
            />
          </div>

          {/* Content Type */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-300 mb-3">Content Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CONTENT_TYPES.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => setContentType(ct.id)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 justify-center
                    ${contentType === ct.id
                      ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-lg shadow-amber-900/20'
                      : 'bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                >
                  <span className="text-base">{ct.emoji}</span>
                  <span className="truncate">{ct.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-300 mb-3">Tone</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all
                    ${tone === t.id
                      ? `bg-gradient-to-r ${t.color} text-white shadow-lg`
                      : 'bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topic */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Topic / Instructions
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What should the content be about? Be as specific as you like..."
              rows={4}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-amber-500 outline-none transition-colors resize-none placeholder-slate-600"
            />
          </div>

          {/* Generate Button */}
          {!result && !isGenerating && (
            <motion.button
              onClick={generateContent}
              disabled={!topic.trim()}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-lg shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Generate Content <Sparkles className="w-5 h-5" />
            </motion.button>
          )}

          {/* Loading */}
          {isGenerating && (
            <div className="w-full py-8 flex flex-col items-center gap-4">
              <div className="relative w-16 h-16">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                  className="absolute inset-0 border-2 border-transparent border-t-amber-500 border-r-orange-500 rounded-full"
                />
                <div className="absolute inset-2 flex items-center justify-center">
                  <PenLine className="w-6 h-6 text-amber-400" />
                </div>
              </div>
              <p className="text-slate-400 text-sm font-medium animate-pulse">
                {personaName.trim() || 'AI'} is writing your {getContentTypeLabel().toLowerCase()}...
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6"
              >
                {/* Result card */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 relative overflow-hidden">
                  {/* Background accent */}
                  <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 blur-3xl rounded-full" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/5 blur-3xl rounded-full" />

                  {/* Top bar */}
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                        {getContentTypeLabel()} · {getToneLabel()}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {wordCount} words · {charCount} chars
                    </span>
                  </div>

                  {/* Content */}
                  <div className="text-slate-200 text-base leading-relaxed whitespace-pre-wrap relative z-10">
                    {result}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-6 relative z-10">
                    <motion.button
                      onClick={copyToClipboard}
                      whileTap={{ scale: 0.95 }}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        copied
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                      }`}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </motion.button>

                    <motion.button
                      onClick={regenerate}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Regenerate
                    </motion.button>

                    <button
                      onClick={() => { setResult(''); setTopic(''); }}
                      className="ml-auto text-sm text-slate-500 hover:text-white transition-colors underline underline-offset-2"
                    >
                      Start fresh
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default SmartWriter;
