type SkeletonProps = {
  /** Clases de tamaño/forma (h-4 w-32, h-24 w-full, rounded-full…). */
  className?: string;
};

// Placeholder de carga con shimmer — sustituye a los spinners en cards y tablas.
// El gradiente se desplaza con la animación `shimmer` del preset compartido.
export function Skeleton({ className = 'h-4 w-full' }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-zinc-800/60 ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
      }}
    />
  );
}

// Bloque de skeleton para una card KPI completa.
export function SkeletonCard() {
  return (
    <div className="glass-panel space-y-4 rounded-2xl p-6">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}
