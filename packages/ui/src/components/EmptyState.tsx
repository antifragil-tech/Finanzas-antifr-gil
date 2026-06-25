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
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      <Icon className="w-8 h-8 text-zinc-700 mb-4" />
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      {description && <p className="text-xs text-zinc-600 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
