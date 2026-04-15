import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, Users, Mic, PenLine } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import DebateRoom from './studio/DebateRoom';
import LiveCall from './studio/LiveCall';
import SmartWriter from './studio/SmartWriter';

type StudioMode = 'menu' | 'debate' | 'voice' | 'writer';

const PersonaStudio: React.FC = () => {
  const navigate = useNavigate();
  const [currentMode, setCurrentMode] = useState<StudioMode>('menu');

  const modes = [
    {
      id: 'debate' as const,
      title: 'AI Debate Room',
      description: 'Watch two Personas autonomously argue or discuss any topic you give them.',
      icon: Users,
      color: 'from-indigo-500 to-purple-500',
      emoji: '🗣️',
    },
    {
      id: 'voice' as const,
      title: 'Live Phone Call',
      description: 'Have a hands-free, real-time voice conversation with your favorite Persona.',
      icon: Mic,
      color: 'from-emerald-500 to-teal-500',
      emoji: '📞',
    },
    {
      id: 'writer' as const,
      title: 'AI Smart Writer',
      description: 'Generate polished emails, tweets, blogs & more in any Persona\'s unique voice.',
      icon: PenLine,
      color: 'from-amber-500 to-orange-500',
      emoji: '✍️',
    },
  ];

  const renderMode = () => {
    switch (currentMode) {
      case 'debate':
        return <DebateRoom onBack={() => setCurrentMode('menu')} />;
      case 'voice':
        return <LiveCall onBack={() => setCurrentMode('menu')} />;
      case 'writer':
        return <SmartWriter onBack={() => setCurrentMode('menu')} />;
      default:
        return null;
    }
  };

  if (currentMode !== 'menu') {
    return renderMode();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white py-12 px-4">
      <div className="max-w-6xl mx-auto mb-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          Back Home
        </button>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-xl">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Persona Studio</h1>
          </div>
          <p className="text-lg text-slate-400 max-w-2xl">
            Welcome to the AI capabilities lab. Choose a cutting-edge experiment below to push your custom Personas to their limits.
          </p>
        </motion.div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <AnimatePresence>
          {modes.map((mode, index) => {
            const IconComponent = mode.icon;
            return (
              <motion.div
                key={mode.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                onClick={() => setCurrentMode(mode.id)}
                className="group cursor-pointer"
              >
                <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${mode.color} p-[1px] shadow-2xl transition-all h-full`}>
                  <div className="bg-slate-900 rounded-[23px] p-8 h-full relative overflow-hidden flex flex-col">
                    {/* Background glow */}
                    <div className={`absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br ${mode.color} rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity`}></div>
                    
                    <div className="flex items-start justify-between mb-8 relative z-10">
                      <div className={`p-4 bg-gradient-to-br ${mode.color} rounded-2xl shadow-lg`}>
                        <IconComponent className="h-7 w-7 text-white" />
                      </div>
                      <div className="text-4xl bg-white/5 w-14 h-14 flex items-center justify-center rounded-2xl border border-white/10 backdrop-blur-sm shadow-xl">
                        {mode.emoji}
                      </div>
                    </div>
                    
                    <h3 className="text-2xl font-bold text-white mb-3 relative z-10 tracking-tight">
                      {mode.title}
                    </h3>
                    <p className="text-slate-400 mb-8 relative z-10 leading-relaxed font-medium">
                      {mode.description}
                    </p>
                    
                    <motion.button className={`mt-auto inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r ${mode.color} text-white font-bold text-sm shadow-lg shadow-black/20 w-full justify-center`}>
                      Launch Experiment
                      <Sparkles className="w-4 h-4 ml-1" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PersonaStudio;
