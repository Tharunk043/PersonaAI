import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Send } from 'lucide-react';
import { generateChatResponse } from '../../services/groq';

const TypewriterText = React.memo(({ text, isP1 }: { text: string, isP1: boolean }) => {
  const words = text.split(" ");
  const [isTyping, setIsTyping] = useState(true);

  // Auto-hide equalizer when typing finishes
  useEffect(() => {
    setIsTyping(true);
    const timer = setTimeout(() => {
      setIsTyping(false);
    }, words.length * 350 + 500); // 350ms per word + buffer
    return () => clearTimeout(timer);
  }, [text, words.length]);

  return (
    <div className="relative">
      <div className="inline">
        {words.map((word, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: i * 0.35 }}
          >
            {word}{' '}
          </motion.span>
        ))}
      </div>
      {isTyping && (
         <span className="inline-flex items-center gap-[3px] ml-3 translate-y-[2px]">
           <motion.div animate={{ height: ['5px', '14px', '5px'] }} transition={{ repeat: Infinity, duration: 0.5 }} className={`w-1 rounded-full ${isP1 ? 'bg-indigo-400' : 'bg-purple-400'}`}></motion.div>
           <motion.div animate={{ height: ['8px', '5px', '16px', '8px'] }} transition={{ repeat: Infinity, duration: 0.6 }} className={`w-1 rounded-full ${isP1 ? 'bg-indigo-400' : 'bg-purple-400'}`}></motion.div>
           <motion.div animate={{ height: ['5px', '12px', '5px'] }} transition={{ repeat: Infinity, duration: 0.7 }} className={`w-1 rounded-full ${isP1 ? 'bg-indigo-400' : 'bg-purple-400'}`}></motion.div>
         </span>
      )}
    </div>
  );
});

const DebateRoom: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [topic, setTopic] = useState('');
  const [isDebating, setIsDebating] = useState(false);
  const [messages, setMessages] = useState<{ id: string; speaker: number; text: string }[]>([]);
  const [persona1, setPersona1] = useState('Pirate Captain');
  const [persona2, setPersona2] = useState('Strict Victorian Teacher');
  const [debateError, setDebateError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  
  const debateInterval = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isDebatingRef = useRef(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    // Load voices early
    synthRef.current = window.speechSynthesis;
    if (synthRef.current) {
      synthRef.current.getVoices();
    }
    return () => {
      synthRef.current?.cancel();
    };
  }, []);

  const guessGender = (name: string) => {
    const lower = name.toLowerCase();
    if (/(woman|female|girl|lady|queen|princess|mom|mother|aunt|sister|mrs|miss|ms|witch)/i.test(lower)) return 'female';
    if (/(man|male|boy|lord|king|prince|dad|father|uncle|brother|mr|wizard|pirate)/i.test(lower)) return 'male';
    const firstWord = lower.split(' ')[0];
    if (firstWord.endsWith('a') || firstWord.endsWith('i') || firstWord.endsWith('y') || firstWord.endsWith('e')) return 'female';
    return 'male';
  };

  const speakMessage = (text: string, isP1: boolean) => {
    if (!audioEnabled || !synthRef.current) return;
    
    synthRef.current.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const voices = synthRef.current.getVoices().filter(v => v.lang.startsWith('en'));
    
    const pName = isP1 ? persona1 : persona2;
    const gender = guessGender(pName);
    
    let voice: SpeechSynthesisVoice | undefined;
    if (gender === 'female') {
      voice = voices.find(v => /female|woman|zira|samantha|victoria|karen/i.test(v.name)) || voices[1];
    } else {
      voice = voices.find(v => /male|man|david|daniel|mark|paul/i.test(v.name)) || voices[0];
    }
    
    // Ensure P1 and P2 definitely have different voices if their gender guesses matched
    if (!isP1 && voice && voice.name === (synthRef.current as any)._lastP1Voice) {
      voice = voices.find(v => v.name !== voice?.name) || voices[voices.length - 1];
    }
    if (isP1 && voice) {
      (synthRef.current as any)._lastP1Voice = voice.name;
    }

    if (voice) utt.voice = voice;
    
    // Slight pitch tweaks to ensure distinctness even more
    utt.pitch = isP1 ? 1.1 : 0.9;
    utt.rate = 1.05;
    
    synthRef.current.speak(utt);
  };

  const startDebate = async () => {
    if (!topic.trim()) return;
    setIsDebating(true);
    isDebatingRef.current = true;
    setDebateError(null);
    setMessages([{ id: Date.now().toString(), speaker: 0, text: `The debate topic is: ${topic}` }]);
    triggerNextSpeaker(1, [`The debate topic is: ${topic}`]);
  };

  const stopDebate = () => {
    setIsDebating(false);
    isDebatingRef.current = false;
  };

  const triggerNextSpeaker = async (speaker: number, historyContents: string[]) => {
    if (!isDebatingRef.current) return;


    const pName = speaker === 1 ? persona1 : persona2;
    const opponent = speaker === 1 ? persona2 : persona1;
    
    // Create system prompt
    const systemPrompt = `You are an AI entirely embodying the persona of ${pName}. 
You are currently engaged in a very heated debate/conversation with ${opponent}.
The topic of this conversation is: "${topic}".
Read the conversation transcript, and generate YOUR next response. 
CRITICAL: Your response MUST be exactly ONE SINGLE SENTENCE (maximum 15-20 words). Speak exactly like a real human in a fast-paced, snappy conversation. Do NOT output paragraphs.
Stay entirely in character, NEVER mention you are an AI, and directly argue or agree with the previous speaker in your unique tone.
DO NOT prepend your response with your name like "${pName}:", just output the dialogue directly.`;

    // Rather than dealing with strictly alternating 'user'/'assistant' arrays which can 
    // break the Groq/Llama API schema constraints, just provide the full transcript.
    const transcript = historyContents.map((text, i) => {
      if (i === 0) return `[SYSTEM]: ${text}`;
      const name = (i % 2 !== 0) ? persona1 : persona2;
      return `[${name}]: ${text}`;
    }).join('\n\n');

    const promptText = `Here is the transcript of the debate so far:\n\n${transcript}\n\nIt is now your turn. What do you say?`;

    try {
      const response = await generateChatResponse(systemPrompt, [], promptText);
      const newHistory = [...historyContents, response];
      
      setMessages(prev => [...prev, { id: Date.now().toString(), speaker, text: response }]);
      speakMessage(response, speaker === 1);
      
      // Schedule next speaker if still debating with an 8-second delay
      if (isDebatingRef.current) {
        // Clear old interval just in case
        clearTimeout(debateInterval.current);
        debateInterval.current = setTimeout(() => {
          triggerNextSpeaker(speaker === 1 ? 2 : 1, newHistory);
        }, 8000);
      }

    } catch (error: any) {
      console.error(error);
      setIsDebating(false);
      isDebatingRef.current = false;
      setDebateError(error.message || "An API error occurred right now.");
    }
  };

  // Stop debate cleanly when unmounting or stopping
  useEffect(() => {
    return () => clearTimeout(debateInterval.current);
  }, []);

  useEffect(() => {
    if (!isDebating) clearTimeout(debateInterval.current);
  }, [isDebating]);

  // Remove auto-scroll to allow manual reading
  // useEffect(() => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  // }, [messages]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col py-8 px-4 h-full">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col h-full">
        <button
          onClick={onBack}
          className="flex flex-shrink-0 items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors self-start"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Studio
        </button>

        <div className="flex items-center gap-3 mb-8 flex-shrink-0">
          <div className="p-3 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">AI Debate Room</h1>
            <p className="text-slate-400 text-sm">Watch two personas autonomously discuss any topic.</p>
          </div>
        </div>

        {/* Configuration */}
        {!isDebating && messages.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 flex-shrink-0">
            <h3 className="font-semibold mb-4 text-lg">Configure the Debate</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Persona 1</label>
                <input 
                  type="text" 
                  value={persona1}
                  onChange={(e) => setPersona1(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Persona 2</label>
                <input 
                  type="text" 
                  value={persona2}
                  onChange={(e) => setPersona2(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Debate Topic</label>
              <textarea 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Which is better: living in the past or the future?"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none resize-none h-24"
              />
            </div>
            
            <button 
              onClick={startDebate}
              disabled={!topic.trim() || !persona1.trim() || !persona2.trim()}
              className="mt-6 w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 font-bold hover:shadow-lg hover:shadow-indigo-500/20 disabled:opacity-50 transition-all flex justify-center items-center gap-2"
            >
              Start Autonomous Debate <Send className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Debate Arena */}
        {(messages.length > 0 || isDebating) && (
          <div className="flex-1 border border-slate-800 bg-slate-900/50 rounded-2xl p-4 flex flex-col overflow-hidden relative min-h-[500px]">
            
            {debateError && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-900/90 text-white text-sm px-6 py-3 rounded-xl z-20 shadow-2xl border border-red-500 max-w-sm text-center">
                ⚠️ <strong>Debate Stopped:</strong> {debateError}
              </div>
            )}

            {/* Control Bar */}
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              {!isDebating && (
                <button 
                  onClick={() => setAudioEnabled(!audioEnabled)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${audioEnabled ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                  {audioEnabled ? '🔊 Audio On' : '🔈 Audio Off'}
                </button>
              )}
              <button 
                onClick={stopDebate}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isDebating ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-slate-800 text-slate-400 opacity-50 cursor-not-allowed'}`}
                disabled={!isDebating}
              >
                Stop Debate
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2 pt-12 pb-4 custom-scrollbar">
              {messages.map((msg, idx) => {
                if (msg.speaker === 0) {
                  return (
                    <div key={msg.id} className="text-center my-6">
                      <span className="bg-slate-800 text-slate-300 text-xs px-3 py-1 rounded-full uppercase tracking-wider font-semibold">
                        System: {msg.text}
                      </span>
                    </div>
                  );
                }
                
                const isP1 = msg.speaker === 1;
                return (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    key={msg.id} 
                    className={`flex ${isP1 ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[80%] p-4 rounded-xl shadow-md ${isP1 ? 'bg-indigo-500/15 border border-indigo-500/20 rounded-tl-sm' : 'bg-purple-500/15 border border-purple-500/20 rounded-tr-sm'}`}>
                      <div className={`text-xs font-bold mb-1 uppercase tracking-wide opacity-80 ${isP1 ? 'text-indigo-400' : 'text-purple-400'}`}>
                        {isP1 ? persona1 : persona2}
                      </div>
                      <div className="text-slate-100 text-lg leading-relaxed font-medium">
                        <TypewriterText text={msg.text} isP1={isP1} />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              
              {isDebating && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex mt-6 ${messages.length % 2 === 1 ? 'justify-start' : 'justify-end'}`}>
                  <div className={`flex flex-col gap-1 max-w-[80%] ${messages.length % 2 === 1 ? 'items-start' : 'items-end'}`}>
                    <span className={`text-xs font-bold uppercase tracking-wide opacity-50 ${messages.length % 2 === 1 ? 'text-indigo-400' : 'text-purple-400'}`}>
                      {messages.length % 2 === 1 ? persona1 : persona2} is listening...
                    </span>
                    <div className="px-4 py-3 bg-slate-800/30 border border-slate-700/30 rounded-2xl flex items-center justify-center gap-1 shadow-sm w-16">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-[pulse_1.5s_infinite]"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-[pulse_1.5s_infinite_200ms]"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-[pulse_1.5s_infinite_400ms]"></div>
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.4); border-radius: 4px; cursor: pointer; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.6); }
      `}</style>
    </div>
  );
};

export default DebateRoom;
