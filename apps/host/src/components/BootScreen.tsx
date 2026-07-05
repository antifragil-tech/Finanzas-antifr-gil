import Image from 'next/image';

export function BootScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950">
      <p className="animate-pulse text-2xl font-light uppercase tracking-[0.35em] text-zinc-200">Antifrágil</p>
      <p className="mt-3 text-sm font-medium tracking-wider text-zinc-500">SISTEMA OPERATIVO INTERNO</p>
    </div>
  );
}
