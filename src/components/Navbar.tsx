import React, { useEffect, useRef } from "react";
import { Sparkles, LogOut } from "lucide-react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Lightweight Magnetic wrapper (self-contained for Navbar)
const Magnetic: React.FC<{ className?: string; onClick?: () => void } & React.PropsWithChildren> = ({ children, className, onClick }) => {
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
      const relX = e.clientX - (rect.left + rect.width / 2);
      const relY = e.clientY - (rect.top + rect.height / 2);
      mx.set(relX * 0.2);
      my.set(relY * 0.2);
    };
    const onLeave = () => {
      mx.set(0);
      my.set(0);
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [mx, my]);

  return (
    <motion.div ref={ref} style={{ x, y }} className={className} onClick={onClick}>
      {children}
    </motion.div>
  );
};

const Navbar: React.FC<{ sticky?: boolean }> = ({ sticky = true }) => {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();

  const LinkButton: React.FC<{ label: string; to: string }>= ({ label, to }) => (
    <button
      onClick={() => navigate(to)}
      className="text-sm text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
    >
      {label}
    </button>
  );

  return (
    <header className={`${sticky ? "sticky top-0" : ""} z-30 w-full backdrop-blur supports-[backdrop-filter]:bg-white/40 dark:supports-[backdrop-filter]:bg-slate-900/30`}> 
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Left: Logo */}
        <button onClick={() => navigate("/")} className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Persona Studio</span>
        </button>

        {/* Center: Links (desktop) */}
        <nav className="hidden items-center gap-6 md:flex">
            <LinkButton label="Home" to="/" />
          <LinkButton label="About" to="/about" />
          <LinkButton label="Pricing" to="/pricing" />
          <LinkButton label="Contact" to="/contact" />
        </nav>

        {/* Right: CTA */}
        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-slate-600 dark:text-slate-300">Hi, {user?.name}</span>
              <Magnetic>
                <button
                  onClick={() => { logout(); navigate('/'); }}
                  className="group relative flex items-center gap-1.5 overflow-hidden rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-transform hover:-translate-y-0.5 dark:border-white/10 dark:text-slate-200"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </Magnetic>
            </>
          ) : (
            <Magnetic>
              <button
                onClick={() => navigate("/login")}
                className="group relative overflow-hidden rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-md transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-900"
              >
                <span className="relative z-10">Get started</span>
                <span className="absolute inset-0 -translate-y-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-transform duration-300 group-hover:translate-y-0" />
              </button>
            </Magnetic>
          )}
        </div>

        {/* Mobile hamburger (optional simple) */}
        <div className="md:hidden">
          <button
            onClick={() => navigate("/menu")}
            className="rounded-lg border border-white/20 bg-white/60 px-3 py-1.5 text-sm font-medium backdrop-blur transition hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/20"
          >
            Menu
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
