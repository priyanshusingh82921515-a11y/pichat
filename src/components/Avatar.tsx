import { useState } from 'react';
import type { OnlineStatus } from '../types/chat';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: OnlineStatus;
  showStatus?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-xs',
  lg: 'w-11 h-11 text-sm',
  xl: 'w-16 h-16 text-lg',
};

const DOT_MAP = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
};

const STATUS_COLORS: Record<OnlineStatus, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-500',
  busy: 'bg-red-500',
  offline: 'bg-stone-400 dark:bg-slate-600',
};

const PALETTE = [
  'bg-emerald-700 text-white',
  'bg-teal-700 text-white',
  'bg-slate-700 text-white',
  'bg-amber-700 text-white',
  'bg-sky-700 text-white',
  'bg-stone-700 text-white',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getTone(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function Avatar({
  name,
  src,
  size = 'md',
  status,
  showStatus = false,
  className = '',
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {src && !imgError ? (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={`${SIZE_MAP[size]} rounded-full object-cover bg-stone-200 dark:bg-slate-800`}
        />
      ) : (
        <div
          aria-label={name}
          className={`${SIZE_MAP[size]} ${getTone(name)} rounded-full flex items-center justify-center font-display font-semibold select-none`}
        >
          {getInitials(name)}
        </div>
      )}
      {showStatus && status && (
        <span
          title={`Status: ${status}`}
          className={`absolute -bottom-0.5 -right-0.5 ${DOT_MAP[size]} ${STATUS_COLORS[status]} rounded-full ring-2 ring-white dark:ring-[#161B22]`}
        />
      )}
    </div>
  );
}
