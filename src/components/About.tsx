import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { Sparkles, Heart, Users, Zap, Shield, Globe2, MessageCircle, ChevronDown, ArrowRight } from "lucide-react";

// --------------------------------------------------
// Local visual helpers (no external deps beyond framer-motion + tailwind)
// --------------------------------------------------
const AuroraBackground: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_20%,rgba(99,102,241,0.25),transparent_60%)]" />
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2 }}
      className="absolute -top-40 -left-40 h-[55rem] w-[55rem] rounded-full blur-3xl"
      style={{
        background:
          "conic-gradient(from 90deg at 50% 50%, rgba(99,102,241,0.35), rgba(147,51,234,0.35), rgba(59,130,246,0.35), rgba(99,102,241,0.35))",
      }}
    />
    <motion.div
      aria-hidden
      className="absolute -bottom-40 -right-40 h-[50rem] w-[50rem] rounded-full blur-3xl"
      style={{
        background:
          "conic-gradient(from 45deg at 50% 50%, rgba(236,72,153,0.25), rgba(14,165,233,0.25), rgba(16,185,129,0.25), rgba(236,72,153,0.25))",
      }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 80, ease: "linear" }}
    />
  </div>
);

const GlassCard: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = "" }) => (
  <motion.div
    whileHover={{ y: -6 }}
    transition={{ type: "spring", stiffness: 140, damping: 12 }}
    className={
      "group relative rounded-2xl border border-white/10 bg-white/10 p-5 shadow-xl shadow-black/10 backdrop-blur-xl " +
      "dark:bg-white/5 dark:border-white/10 " +
      className
    }
  >
    <div
      className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      style={{ background: "linear-gradient(120deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02) 30%, transparent 70%)" }}
    />
    {children}
  </motion.div>
);

// Animated counter
const Stat: React.FC<{ label: string; value: number; suffix?: string }>= ({ label, value, suffix = "" }) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 120, damping: 18 });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (inView) mv.set(value);
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return () => unsub();
  }, [inView, mv, spring, value]);
  return (
    <div className="text-center">
      <span ref={ref} className="block text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        {display.toLocaleString()}{suffix}
      </span>
      <span className="mt-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{label}</span>
    </div>
  );
};

// FAQ item
const FAQItem: React.FC<{ q: string; a: string }>= ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/10 bg-white/50 p-4 backdrop-blur dark:bg-white/10">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <span className="text-sm font-semibold text-slate-900 dark:text-white">{q}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <motion.div initial={false} animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }} className="overflow-hidden">
        <p className="pt-3 text-sm text-slate-600 dark:text-slate-300">{a}</p>
      </motion.div>
    </div>
  );
};

const About: React.FC = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-gray-950 dark:text-slate-100">
      <AuroraBackground />

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-12 pt-24 sm:px-6 lg:px-8 lg:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1 text-xs font-semibold backdrop-blur dark:bg-white/10">
              <Sparkles className="h-3.5 w-3.5" /> Our Story
            </span>
            <h1 className="mt-4 bg-gradient-to-b from-slate-900 to-slate-700 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent dark:from-white dark:to-slate-300 sm:text-6xl">
              About Persona AI
            </h1>
            <p className="mt-5 text-lg leading-7 text-slate-600 dark:text-slate-300">
              We help creators scale authentic engagement using AI-powered persona replicas trained on public content.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <button className="rounded-2xl border border-white/20 bg-white/70 px-6 py-3 text-sm font-semibold backdrop-blur transition hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/20">
                Read our manifesto
              </button>
              <button className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-lg">
                Get a demo <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 rounded-2xl border border-white/10 bg-white/50 p-6 backdrop-blur md:grid-cols-4 dark:bg-white/10">
          <Stat label="Fans Reached" value={2480000} />
          <Stat label="Personas Trained" value={1200} />
          <Stat label="Avg. Response Boost" value={38} suffix="%" />
          <Stat label="Global Markets" value={26} />
        </div>
      </section>

      {/* Mission & How it works */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <GlassCard>
            <h2 className="text-2xl font-bold">Our Mission</h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Bridge the gap between creators and communities by enabling safe, scalable, and authentic conversations—anytime, anywhere.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2"><Heart className="mt-0.5 h-4 w-4 text-pink-500"/> Enhance fan delight</li>
              <li className="flex items-start gap-2"><Users className="mt-0.5 h-4 w-4 text-indigo-500"/> Scale creator time</li>
              <li className="flex items-start gap-2"><Shield className="mt-0.5 h-4 w-4 text-emerald-500"/> Prioritize safety & privacy</li>
            </ul>
          </GlassCard>

          <GlassCard>
            <h2 className="text-2xl font-bold">How It Works</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
              <li>Provide public profile links for consented creators.</li>
              <li>Our AI analyzes tone, topics, and style from public content.</li>
              <li>We assemble a tuned persona with guardrails and controls.</li>
              <li>Engage via chat, voice, or API across your channels.</li>
            </ol>
          </GlassCard>
        </div>
      </section>

      {/* Feature cards */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Why creators choose us</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[{icon: <Zap className="h-5 w-5"/>, title: "Fast setup", text: "Train and deploy a persona in hours, not weeks."},
            {icon: <Globe2 className="h-5 w-5"/>, title: "Omnichannel", text: "Web, mobile, and chat apps with one persona core."},
            {icon: <MessageCircle className="h-5 w-5"/>, title: "Conversational magic", text: "Natural voice and chat with memory & style."}].map((f, i) => (
              <GlassCard key={i}>
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/60 backdrop-blur dark:bg-white/10">{f.icon}</div>
                  <div>
                    <h3 className="text-base font-semibold">{f.title}</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{f.text}</p>
                  </div>
                </div>
              </GlassCard>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-2xl font-bold tracking-tight">Team</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { name: "Tharun Velamakuru", role: "Front-End", img: "https://media.licdn.com/dms/image/v2/D5635AQHrjy9g-6nXUQ/profile-framedphoto-shrink_200_200/B56ZhqYsS0HMAY-/0/1754131514866?e=1764046800&v=beta&t=DDHQo41IXsLGrdqpJ3aezdKdg9OQeHMPGISg1yMWo90" },
            { name: "Hemsai", role: "Integration", img: "https://media.licdn.com/dms/image/v2/D4E35AQEEqLQOlshR1Q/profile-framedphoto-shrink_200_200/B4EZk8ellFIwAc-/0/1757656276290?e=1764046800&v=beta&t=zezUMTx0JRlBqz4vZHXqrBPnxdQYRo5zSQGay_nuxkg" },
            { name: "Irmiya", role: "Back-End", img: "https://media.licdn.com/dms/image/v2/D5635AQHoyAtcL5ynZQ/profile-framedphoto-shrink_200_200/B56ZTklbUXHQAY-/0/1739001804358?e=1764046800&v=beta&t=ldhr57lr5OOLnLke8t4WiyNu3sJXAIYgPwt4NJEGa9Q" },
          ].map((m) => (
            <GlassCard key={m.name}>
                              <img
                  src={m.img}
                  alt={m.name}
                  loading="lazy"
                  className="h-40 w-40 rounded-full object-cover mx-auto shadow-lg border-2 border-white/40 dark:border-white/10"
                  style={{ aspectRatio: "1 / 1" }}
                />

              <div className="mt-3">
                <p className="text-base font-semibold">{m.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{m.role}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-2xl font-bold tracking-tight">Milestones</h2>
        <div className="relative pl-6">
          <div className="absolute left-2 top-0 h-full w-px bg-white/20" />
          {[
            { t: "2024 Q4", d: "Prototype launched with 10 creators" },
            { t: "2025 Q1", d: "Voice personas shipped" },
            { t: "2025 Q2", d: "Cross-platform SDK released" },
          ].map((ev, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: idx*0.1 }} className="mb-5 flex items-start gap-4">
              <div className="mt-1 h-3 w-3 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500" />
              <div>
                <p className="text-sm font-semibold">{ev.t}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{ev.d}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-center text-2xl font-bold tracking-tight">FAQ</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FAQItem q="Do you need creator consent?" a="Yes. We only build personas with explicit permission and follow platform policies." />
          <FAQItem q="What data is used?" a="Only public content provided by the creator or their team, processed with safety guardrails." />
          <FAQItem q="Is my data secure?" a="We apply encryption in transit and at rest, with strict access controls and audit trails." />
          <FAQItem q="How fast is onboarding?" a="Most teams can launch a first version within a few days once content is approved." />
        </div>
      </section>

      {/* CTA Footer banner */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-[1px] shadow-xl">
          <div className="relative rounded-2xl bg-white/70 p-10 text-center backdrop-blur dark:bg-white/10">
            <h3 className="text-2xl font-bold">Ready to craft your first persona?</h3>
            <p className="mt-2 text-slate-700 dark:text-slate-300">Book a demo and see how quickly you can go live.</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button className="rounded-xl border border-white/20 bg-white/60 px-6 py-3 text-sm font-semibold backdrop-blur transition hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/20">Contact sales</button>
              <button className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Get started <ArrowRight className="h-4 w-4"/></button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
