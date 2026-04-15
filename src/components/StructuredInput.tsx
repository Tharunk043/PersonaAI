import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Save, ArrowLeft, UserCircle2, BrainCircuit, Sparkles, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generatePersonaPrompt } from '../utils/promptGenerator';

const cardVariant = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const inputStyles = "w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-all";
const labelStyles = "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-2";

const StructuredInput: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    personality: '',
    toneOfVoice: '',
    commonPhrases: '',
    interests: '',
    expertise: '',
    responseStyle: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    const personaPrompt = generatePersonaPrompt(formData);
    navigate('/chat', { state: { personaPrompt } });
  };

  const livePreview = useMemo(() => {
    if (!formData.name && !formData.bio) return "Your persona's system prompt will appear here. Start typing to see the magic...";
    return generatePersonaPrompt(formData);
  }, [formData]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <button
          onClick={() => navigate('/manual-input')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-6 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          
          {/* Left Column: Form */}
          <motion.div variants={cardVariant} initial="hidden" animate="show" className="lg:col-span-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-6 sm:p-8">
            <div className="mb-8 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-200 dark:border-indigo-800">
                <BrainCircuit className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">Design Persona</h1>
                <p className="mt-1 text-gray-500 dark:text-gray-400 font-medium">Define your AI's core traits, logic, and conversational boundaries.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Identity Section */}
              <div className="space-y-4 p-5 rounded-2xl bg-gray-50/50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <UserCircle2 className="w-5 h-5 text-indigo-500" /> Identity
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label htmlFor="name" className={labelStyles}>Name</label>
                    <input
                      type="text" id="name" name="name"
                      value={formData.name} onChange={handleChange}
                      placeholder="e.g. Captain Blackbeard"
                      className={inputStyles} required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="bio" className={labelStyles}>Background & Bio</label>
                    <textarea
                      id="bio" name="bio" rows={2}
                      value={formData.bio} onChange={handleChange}
                      placeholder="e.g. A fearsome pirate from the 18th century..."
                      className={inputStyles} required
                    />
                  </div>
                </div>
              </div>

              {/* Traits Section */}
              <div className="space-y-4 p-5 rounded-2xl bg-gray-50/50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-amber-500" /> Core Traits
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="personality" className={labelStyles}>Personality</label>
                    <input
                      type="text" id="personality" name="personality"
                      value={formData.personality} onChange={handleChange}
                      placeholder="e.g. Bold, adventurous"
                      className={inputStyles} required
                    />
                  </div>
                  <div>
                    <label htmlFor="toneOfVoice" className={labelStyles}>Tone of Voice</label>
                    <input
                      type="text" id="toneOfVoice" name="toneOfVoice"
                      value={formData.toneOfVoice} onChange={handleChange}
                      placeholder="e.g. Gruff, loud"
                      className={inputStyles} required
                    />
                  </div>
                  <div>
                    <label htmlFor="interests" className={labelStyles}>Interests</label>
                    <input
                      type="text" id="interests" name="interests"
                      value={formData.interests} onChange={handleChange}
                      placeholder="e.g. Gold, sailing"
                      className={inputStyles} required
                    />
                  </div>
                  <div>
                    <label htmlFor="expertise" className={labelStyles}>Expertise</label>
                    <input
                      type="text" id="expertise" name="expertise"
                      value={formData.expertise} onChange={handleChange}
                      placeholder="e.g. Navigation, sword fighting"
                      className={inputStyles} required
                    />
                  </div>
                </div>
              </div>

              {/* Communication Rules */}
              <div className="space-y-4 p-5 rounded-2xl bg-gray-50/50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <MessageSquare className="w-5 h-5 text-pink-500" /> Communication
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="responseStyle" className={labelStyles}>Response Style</label>
                    <input
                      type="text" id="responseStyle" name="responseStyle"
                      value={formData.responseStyle} onChange={handleChange}
                      placeholder="e.g. Short and demanding"
                      className={inputStyles} required
                    />
                  </div>
                  <div>
                    <label htmlFor="commonPhrases" className={labelStyles}>Common Phrases</label>
                    <input
                      type="text" id="commonPhrases" name="commonPhrases"
                      value={formData.commonPhrases} onChange={handleChange}
                      placeholder="e.g. 'Arrr matey', 'Shiver me timbers'"
                      className={inputStyles} required
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!formData.name.trim()}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-indigo-500/25 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
              >
                <Save className="w-5 h-5" />
                Deploy Persona
              </button>
            </form>
          </motion.div>

          {/* Right Column: Live Preview Card */}
          <motion.div variants={cardVariant} initial="hidden" animate="show" className="lg:col-span-2 lg:sticky lg:top-6">
            <div className="bg-[#1e1e1e] rounded-3xl overflow-hidden shadow-2xl border border-gray-800 h-[80vh] flex flex-col relative group">
              <div className="px-5 py-4 bg-[#252526] border-b border-gray-800 flex items-center justify-between z-10">
                <h3 className="text-gray-300 font-mono text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  system_prompt.txt
                </h3>
                <div className="text-xs text-gray-500 font-mono bg-black/30 px-2 py-1 rounded">Read-only</div>
              </div>
              
              <div className="flex-1 p-5 overflow-auto custom-scrollbar relative">
                {/* Syntax highlighted raw text look */}
                <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap">
                  {livePreview.split('\n').map((line, i) => {
                    let color = 'text-gray-300';
                    if (line.startsWith('===') || line.startsWith('---') || line.startsWith('================')) color = 'text-amber-500 font-bold';
                    else if (line.startsWith('[')) color = 'text-purple-400 font-bold mt-3';
                    else if (line.match(/^\d+\./)) color = 'text-indigo-400';
                    else if (line.includes(':')) {
                      const [key, ...rest] = line.split(':');
                      if (rest.join(':').trim() === '') {
                        return <div key={i} className={`mb-0.5 ${color} ${!formData.name && 'opacity-40 text-gray-500'}`}>{line}</div>;
                      }
                      return (
                        <div key={i} className="mb-0.5">
                          <span className="text-blue-400">{key}:</span>
                          <span className="text-green-300 ml-1">{rest.join(':')}</span>
                        </div>
                      );
                    }
                    return <div key={i} className={`mb-0.5 ${color} ${!formData.name && 'opacity-40 text-gray-500'}`}>{line}</div>;
                  })}
                </pre>
              </div>
              
              <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-10 transition-opacity" style={{background: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 55%, transparent 60%)', backgroundSize: '200% 200%', animation: 'shimmer 2s infinite linear'}} />
            </div>
            
            <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3" /> This dynamic prompt strictly controls the AI behavior.
            </p>
          </motion.div>
          
        </div>
      </motion.div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1e1e1e; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
        @keyframes shimmer { 0% { background-position: -100% -100%; } 100% { background-position: 200% 200%; } }
      `}</style>
    </div>
  );
};

export default StructuredInput;