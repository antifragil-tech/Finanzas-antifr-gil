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
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center">
          <Image
            src="/logo.png"
            width={64}
            height={64}
            alt="Alsari Capital"
            className="mb-6 object-contain"
          />
          <h1 className="text-brand text-xl font-semibold uppercase tracking-widest">
            Alsari Capital OS
          </h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-zinc-500">
            Neural Finance V3.0
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="text-brand w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm placeholder-zinc-600 transition-colors focus:border-white/25 focus:outline-none"
            />
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              required
              className="text-brand w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm placeholder-zinc-600 transition-colors focus:border-white/25 focus:outline-none"
            />
          </div>

          {error && <p className="text-center text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-brand w-full rounded-lg py-3 text-sm font-semibold uppercase tracking-wider text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Accediendo...' : 'Acceder'}
          </button>
        </form>
      </div>
    </div>
  );
}
