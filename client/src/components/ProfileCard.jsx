import React, { useState } from 'react';
import { Mic, Trash2, Play, Check } from 'lucide-react';
import { PERSONAS_MAP } from '../stores/profileStore.js';
import { api } from '../lib/api.js';

export function ProfileCard({ profile, isActive, onActivate, onDelete }) {
  const persona = PERSONAS_MAP[profile.persona] || PERSONAS_MAP.hormozi;
  const [testing, setTesting] = useState(false);
  const [played, setPlayed] = useState(false);

  const handleTestVoice = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const url = api.voice.testTTS(profile.voice_id);
      const audio = new Audio(url);
      audio.onended = () => { setTesting(false); setPlayed(true); };
      audio.onerror = () => setTesting(false);
      await audio.play();
    } catch (err) {
      console.error('Test TTS failed:', err);
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete profile "${profile.name}"? This removes the voice clone from ElevenLabs.`)) return;
    try {
      await api.voice.deleteClone(profile.voice_id);
    } catch (err) {
      console.warn('ElevenLabs delete failed (may already be gone):', err.message);
    }
    onDelete(profile.id);
  };

  return (
    <div
      className={`
        relative rounded-2xl border p-4 transition-all duration-200 cursor-pointer
        ${isActive
          ? 'border-ghost-accent bg-ghost-card'
          : 'border-ghost-border bg-ghost-surface hover:border-ghost-muted'
        }
      `}
      onClick={onActivate}
      style={isActive ? { boxShadow: '0 0 30px rgba(233,69,96,0.15)' } : {}}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-ghost-green animate-pulse" />
          <span className="text-ghost-green font-mono text-xs">ACTIVE</span>
        </div>
      )}

      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 font-display font-bold text-lg"
        style={{ background: `${persona.color}22`, color: persona.color }}
      >
        {profile.name.charAt(0).toUpperCase()}
      </div>

      <h3 className="font-display font-semibold text-ghost-text text-sm mb-0.5">
        {profile.name}
      </h3>

      <div className="flex items-center gap-1.5 mb-3">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: persona.color }} />
        <span className="text-ghost-sub text-xs font-mono">{persona.name}</span>
      </div>

      <div className="font-mono text-ghost-dim text-xs mb-4 truncate" title={profile.voice_id}>
        ID: {profile.voice_id.slice(0, 16)}…
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); handleTestVoice(); }}
          disabled={testing}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-ghost-border text-ghost-sub hover:text-ghost-text hover:border-ghost-muted transition-all text-xs font-mono"
        >
          {testing ? (
            <span className="animate-pulse">Playing…</span>
          ) : played ? (
            <><Check size={12} className="text-ghost-green" /> Verified</>
          ) : (
            <><Play size={12} /> Test Voice</>
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete(); }}
          className="p-1.5 rounded-lg border border-ghost-border text-ghost-dim hover:text-ghost-accent hover:border-ghost-accent transition-all"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
