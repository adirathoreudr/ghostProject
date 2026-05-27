import React from 'react';

export function GhostLogo({ size = 'md', showTagline = true }) {
  const sizes = {
    sm: { text: 'text-xl', tag: 'text-xs', gap: 'gap-1.5' },
    md: { text: 'text-3xl', tag: 'text-sm', gap: 'gap-2' },
    lg: { text: 'text-5xl', tag: 'text-base', gap: 'gap-3' },
    xl: { text: 'text-7xl', tag: 'text-xl', gap: 'gap-4' },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div className={`flex flex-col ${s.gap}`}>
      <div className="flex items-baseline gap-2">
        <span
          className={`font-display font-bold tracking-tight ${s.text} text-gradient`}
          style={{ letterSpacing: '-0.02em' }}
        >
          GHOST
        </span>
        <span className="text-ghost-dim font-mono text-xs">v1.0</span>
      </div>
      {showTagline && (
        <p className={`${s.tag} text-ghost-sub font-body tracking-widest uppercase`}>
          Real-Time Voice Sales Co-Pilot
        </p>
      )}
    </div>
  );
}
