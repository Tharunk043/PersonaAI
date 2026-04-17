import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const Login: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { isAuthenticated, login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const loginState = location.state as { from?: string; fromState?: unknown } | null;
  const from = loginState?.from && loginState.from !== '/login' ? loginState.from : '/studio';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true, state: loginState?.fromState });
    }
  }, [from, isAuthenticated, loginState?.fromState, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (isSignUp && !name.trim()) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);
    try {
      const result = isSignUp ? await signup(name, email, password) : await login(email, password);
      if (result.ok) {
        navigate(from, { replace: true, state: loginState?.fromState });
      } else {
        setError(result.error || 'Invalid credentials. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_20%,rgba(99,102,241,0.18),transparent_60%)]" />
        <motion.div
          aria-hidden
          className="absolute -top-40 -left-40 h-[50rem] w-[50rem] rounded-full blur-3xl"
          style={{
            background:
              'conic-gradient(from 90deg at 50% 50%, rgba(99,102,241,0.25), rgba(147,51,234,0.25), rgba(59,130,246,0.25), rgba(99,102,241,0.25))',
          }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 80, ease: 'linear' }}
        />
        <motion.div
          aria-hidden
          className="absolute -bottom-40 -right-40 h-[45rem] w-[45rem] rounded-full blur-3xl"
          style={{
            background:
              'conic-gradient(from 45deg at 50% 50%, rgba(236,72,153,0.2), rgba(14,165,233,0.2), rgba(16,185,129,0.2), rgba(236,72,153,0.2))',
          }}
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 90, ease: 'linear' }}
        />
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/30 bg-white/70 p-8 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5 sm:p-10"
      >
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isSignUp ? 'Sign up to start using Persona Studio' : 'Sign in to continue to Persona Studio'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400"
          >
            {error}
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-white/5 dark:focus:border-indigo-500 dark:focus:ring-indigo-800"
                />
              </div>
            </motion.div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-white/5 dark:focus:border-indigo-500 dark:focus:ring-indigo-800"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-white/5 dark:focus:border-indigo-500 dark:focus:ring-indigo-800"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            <span className="relative z-10">{loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}</span>
            {!loading && <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
          </button>
        </form>

        {/* Toggle */}
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            className="font-semibold text-indigo-500 transition hover:text-indigo-600 dark:text-indigo-400"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
