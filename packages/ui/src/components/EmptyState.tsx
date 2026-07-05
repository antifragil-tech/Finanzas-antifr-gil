import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Acción opcional (normalmente un <Button>). */
  action?: ReactNode;
};

// Estado vacío canónico: icono grande apagado + título + hint + CTA opcional.
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center px-6 py-16 text-center">
      <Icon className="mb-4 h-8 w-8 text-zinc-700" />
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-zinc-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
