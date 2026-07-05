import Image from 'next/image';

export function BootScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950">
      <Image
        src="/logo.png"
        width={96}
        height={96}
        className="mb-4 animate-pulse object-contain"
        alt="Alsari Capital"
      />
      <p className="text-sm font-medium tracking-wider text-zinc-500">NEURAL FINANCE V3.0</p>
    </div>
  );
}
