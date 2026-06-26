import Image from 'next/image';

export function BootScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950">
      <Image
        src="/logo.png"
        width={96}
        height={96}
        className="animate-pulse mb-4 object-contain"
        alt="Antifrágil OS"
      />
      <p className="text-zinc-500 text-sm font-medium tracking-wider">ANTIFRÁGIL OS</p>
    </div>
  );
}
