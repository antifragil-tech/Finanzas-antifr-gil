'use client';

import { useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Credenciales incorrectas');
      setLoading(false);
      return;
    }

    router.push('/financiero');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <Image
            src="/logo.png"
            width={64}
            height={64}
            alt="Antifrágil OS"
            className="mb-6 object-contain"
          />
          <h1 className="text-brand text-xl font-semibold tracking-widest uppercase">
            Antifrágil OS
          </h1>
          <p className="text-zinc-500 text-xs tracking-widest mt-1 uppercase">
            Neural Finance V3.0
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-brand placeholder-zinc-600 text-sm focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña"
              required
              className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-brand placeholder-zinc-600 text-sm focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-zinc-950 font-semibold text-sm py-3 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed tracking-wider uppercase"
          >
            {loading ? 'Accediendo...' : 'Acceder'}
          </button>
        </form>
      </div>
    </div>
  );
}
