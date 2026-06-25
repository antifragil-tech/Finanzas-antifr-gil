import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  children?: ReactNode;
};

// Tres niveles del design system + danger para acciones destructivas.
// El primario es claro (crema/blanco sobre oscuro): es la firma visual del OS,
// no usar azul como CTA principal.
const variants: Record<ButtonVariant, string> = {
  primary: 'bg-zinc-100 text-zinc-950 hover:bg-white font-medium',
  secondary: 'bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border border-white/10 font-medium',
  ghost: 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5',
  danger: 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 font-medium',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5',
  md: 'px-4 py-2 text-sm rounded-md gap-2',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center transition-colors duration-200
        disabled:opacity-50 disabled:pointer-events-none
        ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} className="shrink-0" />}
      {children}
    </button>
  );
}
