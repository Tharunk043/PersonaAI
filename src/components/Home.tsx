import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useScroll, useTransform, useInView } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Bot, Globe, BookOpen, Brain, Sparkles, ArrowRight, Zap, Shield, Cpu, MessageSquare, Play, ChevronDown, Star, Users, BarChart3 } from "lucide-react";
import SearchBar from "../components/SearchBar";
import { useAuth } from "./AuthContext";

// ═══════════════════════════════════
// Animated grid background
// ═══════════════════════════════════
const GridBackground: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {/* Animated grid */}
    <div
      className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
      style={{
        backgroundImage: `linear-gradient(rgba(99,102,241,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.8) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }}
    />
    {/* Radial glow center */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.2),transparent_60%)]" />
  </div>
);

// ═══════════════════════════════════
// Aurora blobs + particles
// ═══════════════════════════════════
const AuroraBackground: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 2 }}
      className="absolute -top-60 -left-60 h-[70rem] w-[70rem] rounded-full blur-[120px]"
      style={{ background: "conic-gradient(from 90deg at 50% 50%, rgba(99,102,241,0.3), rgba(147,51,234,0.3), rgba(59,130,246,0.3), rgba(99,102,241,0.3))" }}
    />
    <motion.div
      aria-hidden
      className="absolute -bottom-60 -right-60 h-[60rem] w-[60rem] rounded-full blur-[120px]"
      style={{ background: "conic-gradient(from 45deg at 50% 50%, rgba(236,72,153,0.2), rgba(14,165,233,0.2), rgba(16,185,129,0.2), rgba(236,72,153,0.2))" }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 100, ease: "linear" }}
    />
    {/* Floating particles */}
    {Array.from({ length: 40 }).map((_, i) => (
      <motion.span
        key={i}
        className="absolute h-1 w-1 rounded-full bg-white/40"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          filter: "drop-shadow(0 0 6px rgba(255,255,255,0.6))",
        }}
        animate={{ y: ["0%", "-20%", "0%"], opacity: [0.15, 0.6, 0.15], scale: [0.5, 1.2, 0.5] }}
        transition={{ duration: 5 + Math.random() * 7, repeat: Infinity, delay: Math.random() * 4, ease: "easeInOut" }}
      />
    ))}
  </div>
);

// ═══════════════════════════════════
// Magnetic hover helper
// ═══════════════════════════════════
const Magnetic: React.FC<{ className?: string } & React.PropsWithChildren> = ({ children, className }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 200, damping: 20, mass: 0.3 });
  const y = useSpring(my, { stiffness: 200, damping: 20, mass: 0.3 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      mx.set((e.clientX - (rect.left + rect.width / 2)) * 0.15);
      my.set((e.clientY - (rect.top + rect.height / 2)) * 0.15);
    };
    const onLeave = () => { mx.set(0); my.set(0); };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
  }, [mx, my]);

  return <motion.div ref={ref} style={{ x, y }} className={className}>{children}</motion.div>;
};

// ═══════════════════════════════════
// 3D tilt glass card
// ═══════════════════════════════════
const GlassCard: React.FC<React.PropsWithChildren<{ className?: string; glow?: string }>> = ({ children, className = "", glow }) => {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rxs = useSpring(rx, { stiffness: 150, damping: 12 });
  const rys = useSpring(ry, { stiffness: 150, damping: 12 });

  return (
    <motion.div
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        rx.set((0.5 - (e.clientY - rect.top) / rect.height) * 14);
        ry.set(((e.clientX - rect.left) / rect.width - 0.5) * 14);
      }}
      onMouseLeave={() => { rx.set(0); ry.set(0); }}
      style={{ rotateX: rxs, rotateY: rys, transformStyle: "preserve-3d" }}
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 120, damping: 10 }}
      className={
        "group relative rounded-2xl border border-white/15 bg-white/10 p-5 shadow-xl shadow-black/5 backdrop-blur-xl dark:bg-white/5 dark:border-white/10 " + className
      }
    >
      {glow && (
        <div className="pointer-events-none absolute -inset-1 rounded-2xl opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" style={{ background: glow }} />
      )}
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: "linear-gradient(120deg, rgba(255,255,255,0.12), transparent 50%)" }} />
      {children}
    </motion.div>
  );
};

// ═══════════════════════════════════
// Scroll-reveal wrapper
// ═══════════════════════════════════
const Reveal: React.FC<React.PropsWithChildren<{ delay?: number; direction?: "up" | "left" | "right" }>> = ({ children, delay = 0, direction = "up" }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const offsets = { up: { y: 50 }, left: { x: -60 }, right: { x: 60 } };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...offsets[direction] }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
};

// ═══════════════════════════════════
// Animated counter
// ═══════════════════════════════════
const AnimatedCounter: React.FC<{ target: number; suffix?: string; label: string }> = ({ target, suffix = "", label }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let frame: number;
    const duration = 2000;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setCount(Math.floor(ease * target));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, target]);

  return (
    <div ref={ref} className="text-center">
      <span className="text-4xl font-extrabold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent sm:text-5xl">
        {count.toLocaleString()}{suffix}
      </span>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
};

// ═══════════════════════════════════
// Typewriter with blinking cursor
// ═══════════════════════════════════
const TypewriterLoop: React.FC<{ phrases: string[]; typingSpeed?: number; deletingSpeed?: number; pause?: number }> = ({
  phrases, typingSpeed = 80, deletingSpeed = 50, pause = 1200,
}) => {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (subIndex === phrases[index].length && !deleting) {
      const t = setTimeout(() => setDeleting(true), pause);
      return () => clearTimeout(t);
    }
    if (subIndex === 0 && deleting) {
      setDeleting(false);
      setIndex((p) => (p + 1) % phrases.length);
      return;
    }
    const t = setTimeout(() => setSubIndex((p) => p + (deleting ? -1 : 1)), deleting ? deletingSpeed : typingSpeed);
    return () => clearTimeout(t);
  }, [subIndex, deleting, index, phrases, typingSpeed, deletingSpeed, pause]);

  return (
    <span>
      {phrases[index].substring(0, subIndex)}
      <span className="ml-0.5 inline-block h-[1em] w-[3px] rounded-full bg-indigo-500 animate-pulse" />
    </span>
  );
};

// ═══════════════════════════════════
// Floating badge
// ═══════════════════════════════════
const FloatingBadge: React.FC<{ icon: React.ReactNode; text: string; className?: string; delay?: number }> = ({ icon, text, className = "", delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 1.2 + delay, type: "spring", stiffness: 100 }}
    className={"absolute hidden lg:flex items-center gap-2 rounded-2xl border border-white/20 bg-white/70 px-4 py-2 shadow-lg backdrop-blur-xl dark:bg-white/10 " + className}
  >
    {icon}
    <span className="text-xs font-semibold">{text}</span>
  </motion.div>
);

// ═══════════════════════════════════
// Data
// ═══════════════════════════════════
const featuredPersonas = [
  { name: "Study Assistant", description: "Your AI learning companion", interactions: "165.9m", icon: <Bot className="w-10 h-10 text-indigo-500" />, creator: "@landon", color: "rgba(99,102,241,0.15)" },
  { name: "Creative Writer", description: "Unleash your storytelling potential", interactions: "286.6k", icon: <BookOpen className="w-10 h-10 text-purple-500" />, creator: "@cai-official", color: "rgba(147,51,234,0.15)" },
  { name: "Travel Guide", description: "Plan your perfect adventure", interactions: "927.0k", icon: <Globe className="w-10 h-10 text-blue-500" />, creator: "@cai-official", color: "rgba(59,130,246,0.15)" },
  { name: "Decision Helper", description: "Make better choices, faster", interactions: "158.3k", icon: <Brain className="w-10 h-10 text-emerald-500" />, creator: "@cai-official", color: "rgba(16,185,129,0.15)" },
];

const quickActions = [
  { title: "Plan a trip", subtitle: "with Trip Planner", icon: Globe, path: "/trip-planner", gradient: "from-blue-500 to-cyan-400" },
  { title: "Create Video", subtitle: "with Creative Helper", icon: BookOpen, path: "/creative-helper", gradient: "from-purple-500 to-pink-400" },
  { title: "Persona Studio", subtitle: "AI Sandbox", icon: Sparkles, path: "/studio", gradient: "from-amber-500 to-orange-400" },
  { title: "Get advice", subtitle: "with Decision Helper", icon: Brain, path: "/decision-helper", gradient: "from-emerald-500 to-teal-400" },
];

const steps = [
  { icon: Cpu, title: "Design Your AI", desc: "Tune tone, knowledge, voice style, and emotional personality to match your vision.", num: "01" },
  { icon: MessageSquare, title: "Test & Iterate", desc: "Interactively test how your persona responds, remembers context, and adapts.", num: "02" },
  { icon: Zap, title: "Deploy Anywhere", desc: "Connect your persona to apps, websites, chat platforms, or voice assistants.", num: "03" },
];

const testimonials = [
  { name: "Sarah K.", role: "Product Designer", text: "Persona Studio transformed how our team prototypes conversational AI. The customization depth is incredible.", stars: 5 },
  { name: "James R.", role: "Indie Developer", text: "I built and deployed a travel assistant in under an hour. The voice tuning feature is next-level.", stars: 5 },
  { name: "Priya M.", role: "Content Creator", text: "Finally an AI tool that lets me control personality and tone. My audience engagement doubled.", stars: 5 },
];

// ═══════════════════════════════════
// Page
// ═══════════════════════════════════
const Home: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const startBuilding = () => {
    if (isAuthenticated) {
      navigate("/chat");
      return;
    }

    navigate("/login", { state: { from: "/chat" } });
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    
    const personaMatches = featuredPersonas
      .filter(p => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query))
      .map(p => ({ ...p, type: 'persona' as const }));

    const actionMatches = quickActions
      .filter(a => a.title.toLowerCase().includes(query) || a.subtitle.toLowerCase().includes(query))
      .map(a => ({ ...a, type: 'action' as const }));

    return [...actionMatches, ...personaMatches].slice(0, 6);
  }, [searchQuery]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-gray-950 dark:text-slate-100">
      <GridBackground />
      <AuroraBackground />

      {/* ═══════ HERO ═══════ */}
      <section ref={heroRef} className="relative z-10 overflow-hidden">
        <motion.div style={{ y: heroY, opacity: heroOpacity }}>
          <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pt-28">
            <div className="relative mx-auto max-w-3xl text-center">
              {/* Floating badges */}
              <FloatingBadge icon={<Zap className="h-4 w-4 text-amber-500" />} text="Lightning Fast" className="-left-16 top-4" delay={0} />
              <FloatingBadge icon={<Shield className="h-4 w-4 text-emerald-500" />} text="Enterprise Secure" className="-right-20 top-16" delay={0.2} />
              <FloatingBadge icon={<Users className="h-4 w-4 text-blue-500" />} text="10K+ Users" className="-left-12 bottom-20" delay={0.4} />

              {/* Pill badge */}
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/50 bg-indigo-50/80 px-4 py-1.5 text-xs font-semibold text-indigo-600 backdrop-blur dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" /><span className="inline-flex h-2 w-2 rounded-full bg-indigo-500" /></span>
                  Now with real-time voice
                </span>
              </motion.div>

              {/* Hero heading */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="mt-6 text-5xl font-extrabold tracking-tight sm:text-7xl"
              >
                <span className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent dark:from-white dark:via-slate-200 dark:to-slate-400">
                  <TypewriterLoop
                    phrases={["Create Your Perfect AI", "Design Voice & Style", "Deploy Instantly", "Your AI, Your Rules"]}
                    typingSpeed={85}
                    deletingSpeed={55}
                    pause={1000}
                  />
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300"
              >
                Design, customize, and interact with AI personalities tailored to your needs — with real-time voice, memory, and cross-platform deployment.
              </motion.p>

              {/* Search */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-8 relative">
                <GlassCard className="p-2">
                  <SearchBar value={searchQuery} onChange={setSearchQuery} />
                </GlassCard>

                {/* Search Results Dropdown */}
                <AnimatePresence>
                  {searchResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full mt-4 left-0 right-0 z-50 rounded-3xl border border-white/20 bg-white/80 p-3 shadow-2xl backdrop-blur-2xl dark:bg-gray-900/80"
                    >
                      <div className="space-y-1">
                        {searchResults.map((result, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              if ('path' in result) navigate(result.path);
                              else navigate('/chat', { state: { personaName: result.name } });
                              setSearchQuery("");
                            }}
                            className="flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-colors hover:bg-white/50 dark:hover:bg-white/5 group"
                          >
                            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${'gradient' in result ? `bg-gradient-to-br ${result.gradient}` : 'bg-white/60 dark:bg-white/10'} text-white shadow-lg`}>
                              {'icon' in result && React.isValidElement(result.icon) ? result.icon : 'icon' in result && typeof result.icon !== 'string' ? React.createElement(result.icon as any, { className: "h-5 w-5" }) : <Sparkles className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold">{'title' in result ? result.title : result.name}</p>
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{'subtitle' in result ? result.subtitle : result.description}</p>
                            </div>
                            <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Jump to</span>
                              <ArrowRight className="h-4 w-4 text-indigo-500" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* CTA buttons */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-8 flex items-center justify-center gap-4">
                <Magnetic>
                  <button
                    onClick={startBuilding}
                    className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/30"
                  >
                    <span className="relative z-10">Get Started Free</span>
                    <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    <span className="absolute inset-0 translate-y-full bg-white/20 transition-transform duration-300 group-hover:translate-y-0" />
                  </button>
                </Magnetic>
                <button
                  onClick={() => window.scrollTo({ top: window.innerHeight, behavior: "smooth" })}
                  className="group inline-flex items-center gap-2 rounded-2xl border border-slate-200/60 bg-white/70 px-6 py-3.5 text-sm font-semibold backdrop-blur transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <Play className="h-4 w-4 text-indigo-500" />
                  Watch Demo
                </button>
              </motion.div>

              {/* Trust badges */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-8 flex flex-wrap items-center justify-center gap-4">
                {["Real-time Voice", "Personalized Memory", "Cross-platform", "Enterprise Ready"].map((pill) => (
                  <span key={pill} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/50 px-3 py-1 text-xs font-medium backdrop-blur dark:bg-white/5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {pill}
                  </span>
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2"
        >
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }} className="flex flex-col items-center gap-1 text-slate-400">
            <span className="text-[10px] uppercase tracking-widest">Scroll</span>
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </motion.div>
      </section>

      {/* ═══════ STATS ═══════ */}
      <section className="relative z-10 border-y border-slate-200/50 bg-white/50 py-16 backdrop-blur dark:border-white/5 dark:bg-white/[0.02]">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-4 md:grid-cols-4">
          {[
            { target: 10000, suffix: "+", label: "Active Users" },
            { target: 50, suffix: "+", label: "AI Personas" },
            { target: 99, suffix: "%", label: "Uptime" },
            { target: 2, suffix: "M+", label: "Conversations" },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 0.1}>
              <AnimatedCounter target={s.target} suffix={s.suffix} label={s.label} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════ QUICK ACTIONS ═══════ */}
      <section className="relative z-10 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-500">Quick Actions</span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Jump right in</h2>
              <p className="mx-auto mt-3 max-w-lg text-slate-600 dark:text-slate-400">Choose what you&apos;d like to do and we&apos;ll set everything up for you.</p>
            </div>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action, i) => (
              <Reveal key={action.title} delay={i * 0.1}>
                <GlassCard className="p-0" glow={`linear-gradient(135deg, ${action.gradient.includes("blue") ? "rgba(59,130,246,0.15)" : action.gradient.includes("purple") ? "rgba(147,51,234,0.15)" : action.gradient.includes("amber") ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)"}, transparent)`}>
                  <button onClick={() => navigate(action.path)} className="relative flex w-full items-center gap-4 rounded-2xl p-5 text-left">
                    <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${action.gradient} text-white shadow-lg`}>
                      <action.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{action.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{action.subtitle}</p>
                    </div>
                    <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1" />
                  </button>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section className="relative z-10 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-purple-500">How it works</span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Three steps to your AI</h2>
            </div>
          </Reveal>

          <div className="relative mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Connecting line */}
            <div className="pointer-events-none absolute top-12 hidden h-[2px] w-full bg-gradient-to-r from-transparent via-indigo-300/40 to-transparent md:block dark:via-indigo-500/20" />

            {steps.map((s, i) => (
              <Reveal key={s.num} delay={i * 0.15}>
                <div className="relative flex flex-col items-center text-center">
                  {/* Step number */}
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="relative mb-6 grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-xl shadow-indigo-500/20"
                  >
                    <s.icon className="h-8 w-8" />
                    <span className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-lg bg-white text-[10px] font-extrabold text-indigo-600 shadow-md dark:bg-gray-900 dark:text-indigo-400">
                      {s.num}
                    </span>
                  </motion.div>
                  <h3 className="text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 max-w-xs text-sm text-slate-600 dark:text-slate-400">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FEATURED PERSONAS ═══════ */}
      <section className="relative z-10 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="mb-10 flex items-end justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-blue-500">Explore</span>
                <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Featured Personas</h2>
              </div>
              <button className="text-sm font-semibold text-indigo-500 transition hover:text-indigo-600 dark:text-indigo-400">View all &rarr;</button>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {featuredPersonas.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.1}>
                <GlassCard glow={`radial-gradient(circle, ${p.color}, transparent 70%)`}>
                  <div className="flex items-start gap-4">
                    <motion.div whileHover={{ rotate: 10, scale: 1.1 }} className="shrink-0 grid h-14 w-14 place-items-center rounded-2xl bg-white/60 backdrop-blur dark:bg-white/10">
                      {p.icon}
                    </motion.div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold">{p.name}</p>
                        <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-300">LIVE</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{p.description}</p>
                      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                        <BarChart3 className="h-3 w-3" />
                        <span>{p.interactions} chats</span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span>{p.creator}</span>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ TESTIMONIALS ═══════ */}
      <section className="relative z-10 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-pink-500">Testimonials</span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Loved by creators</h2>
            </div>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.12}>
                <GlassCard className="flex flex-col gap-4">
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.stars }).map((_, si) => (
                      <Star key={si} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">"{t.text}"</p>
                  <div className="mt-auto flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-xs font-bold text-white">
                      {t.name.split(" ").map(w => w[0]).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t.role}</p>
                    </div>
                  </div>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section className="relative z-10 py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-[1px] shadow-2xl shadow-indigo-500/20">
              <div className="relative rounded-3xl bg-white/80 px-8 py-16 backdrop-blur-xl dark:bg-gray-950/80 sm:px-16">
                {/* Animated orbs */}
                <motion.div className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-indigo-500/20 blur-3xl" animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 6 }} />
                <motion.div className="pointer-events-none absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-pink-500/20 blur-3xl" animate={{ scale: [1.2, 1, 1.2] }} transition={{ repeat: Infinity, duration: 6 }} />

                <div className="relative text-center">
                  <motion.div initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl">
                    <Sparkles className="h-8 w-8" />
                  </motion.div>
                  <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Ready to build your AI?</h2>
                  <p className="mx-auto mt-4 max-w-lg text-slate-600 dark:text-slate-300">
                    Join thousands of creators building custom AI personas with real-time voice, memory, and personality.
                  </p>
                  <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Magnetic>
                      <button
                        onClick={startBuilding}
                        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl"
                      >
                        <span className="relative z-10">Start Building — It&apos;s Free</span>
                        <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        <span className="absolute inset-0 translate-y-full bg-white/20 transition-transform duration-300 group-hover:translate-y-0" />
                      </button>
                    </Magnetic>
                    <button
                      onClick={() => navigate("/about")}
                      className="rounded-2xl border border-slate-200 bg-white/60 px-6 py-3.5 text-sm font-semibold backdrop-blur transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    >
                      Learn More
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="relative z-10 border-t border-slate-200/50 py-10 dark:border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold">Persona Studio</span>
            </div>
            <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Persona Studio. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
