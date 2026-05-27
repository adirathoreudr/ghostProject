import React from 'react';
import { PERSONAS } from '../stores/profileStore.js';

export function PersonaSelector({ selected, onSelect }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {PERSONAS.map((persona) => {
        const isSelected = selected === persona.id;
        return (
          <button
            key={persona.id}
            onClick={() => onSelect(persona.id)}
            className={`
              relative p-3 rounded-xl text-left transition-all duration-200 border
              ${isSelected
                ? 'border-ghost-accent bg-ghost-card shadow-lg'
                : 'border-ghost-border bg-ghost-surface hover:border-ghost-muted hover:bg-ghost-card'
              }
            `}
            style={isSelected ? { boxShadow: `0 0 20px ${persona.color}22` } : {}}
          >
            {/* Color dot */}
            <div
              className="w-2 h-2 rounded-full mb-2"
              style={{ background: persona.color }}
            />
            <p className="font-display font-semibold text-ghost-text text-xs leading-tight mb-1">
              {persona.name.split(' ')[0]}
            </p>
            <p className="text-ghost-dim text-xs leading-tight font-mono">
              {persona.tagline.split(' · ')[0]}
            </p>
            {isSelected && (
              <div
                className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
                style={{ background: persona.color }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
