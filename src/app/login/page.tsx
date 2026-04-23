'use client';
import { useState, type FormEvent } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        window.location.href = '/';
      } else {
        setError(data.error || 'Неверный пароль');
      }
    } catch {
      setError('Ошибка подключения к серверу');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(236,72,153,0.18),_transparent_24%),linear-gradient(180deg,_#050816_0%,_#090312_45%,_#050816_100%)] p-4">
      <form onSubmit={handleLogin} className="bg-[linear-gradient(180deg,rgba(10,14,29,0.96)_0%,rgba(5,8,22,0.98)_100%)] p-8 rounded-[32px] shadow-[0_0_50px_rgba(59,130,246,0.14)] border border-cyan-400/10 w-full max-w-sm flex flex-col items-center backdrop-blur-xl">
        <div className="w-20 h-20 bg-[linear-gradient(135deg,_#38bdf8,_#8b5cf6_50%,_#ec4899)] rounded-[24px] flex items-center justify-center mb-6 shadow-[0_0_35px_rgba(56,189,248,0.24)]">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-[0.18em] text-center">Вход в панель</h1>
        <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300/70 mb-8 text-center">Server monitor control</p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full bg-white/5 border border-cyan-400/10 p-4 rounded-2xl outline-none focus:border-cyan-400/40 text-center text-lg tracking-[0.3em] font-black text-white mb-4 transition-all"
        />

        {error && (
          <div className="text-red-300 text-[11px] font-black uppercase tracking-widest mb-4 text-center bg-red-500/10 p-3 rounded-xl w-full border border-red-500/20">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[linear-gradient(135deg,_#38bdf8,_#8b5cf6_50%,_#ec4899)] text-white p-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-[0_0_30px_rgba(168,85,247,0.30)] disabled:opacity-50"
        >
          {isLoading ? 'Загрузка...' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
