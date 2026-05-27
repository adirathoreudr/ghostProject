import React from 'react';

const BAR_COUNT = 24;

export function WaveformVisualizer({ volume = 0, isActive = false, color = '#e94560' }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-12">
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const center = BAR_COUNT / 2;
        const distFromCenter = Math.abs(i - center) / center; // 0 at center, 1 at edges
        const baseHeight = isActive
          ? Math.max(0.1, (volume / 100) * (1 - distFromCenter * 0.5) + Math.random() * 0.3)
          : 0.1;

        return (
          <div
            key={i}
            className="rounded-full transition-all"
            style={{
              width: 3,
              height: 48,
              background: color,
              opacity: isActive ? 0.9 : 0.2,
              transform: `scaleY(${Math.max(0.05, baseHeight)})`,
              transformOrigin: 'center',
              transition: isActive
                ? `transform ${80 + i * 5}ms ease, opacity 300ms ease`
                : 'transform 300ms ease, opacity 300ms ease',
              animationDelay: `${i * 30}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
