import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Zap, Activity, Play } from 'lucide-react';
import { GhostLogo } from '../components/GhostLogo.jsx';
import { ProfileCard } from '../components/ProfileCard.jsx';
import { DemoMode } from '../components/DemoMode.jsx';
import { useProfileStore, PERSONAS_MAP } from '../stores/profileStore.js';
import { api } from '../lib/api.js';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { profiles, activeProfileId, setActiveProfile, removeProfile, canAddProfile } = useProfileStore();
  const [serverStatus, setServerStatus] = useState(null);
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    api.health().then(setServerStatus).catch(() => setServerStatus({ status: 'error' }));
  }, []);

  const activeProfile = profiles.find(p => p.id === activeProfileId);
  const activePersona = activeProfile ? PERSONAS_MAP[activeProfile.persona] : null;

  return (
    <div className="min-h-screen bg-ghost-black">

      {/* Demo mode modal */}
      {showDemo && <DemoMode onClose={() => setShowDemo(false)} />}

      {/* Top Bar */}
      <header
        className="border-b border-ghost-border px-6 py-4 flex items-center justify-between sticky top-0 z-40"
        style={{ background: 'rgba(8,8,16,0.95)', backdropFilter: 'blur(12px)' }}
      >
        <GhostLogo size="sm" showTagline={false} />

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${serverStatus?.status === 'ok' ? 'bg-ghost-green' : 'bg-ghost-accent'} animate-pulse`} />
            <span className="font-mono text-xs text-ghost-sub">
              {serverStatus?.status === 'ok' ? 'server online' : 'server offline'}
            </span>
          </div>
          {activeProfile && activePersona && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ghost-card border border-ghost-border">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: activePersona.color }} />
              <span className="font-mono text-xs text-ghost-text">{activeProfile.name}</span>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">

        {profiles.length === 0 ? (
          <EmptyState onAdd={() => navigate('/onboarding')} />
        ) : (
          <>
            {/* Hero CTA */}
            {activeProfile && (
              <div
                className="glass rounded-2xl p-6 mb-8 flex items-center justify-between"
                style={{ border: '1px solid rgba(233,69,96,0.2)', boxShadow: '0 0 60px rgba(233,69,96,0.05)' }}
              >
                <div>
                  <p className="font-mono text-xs text-ghost-accent uppercase tracking-widest mb-1">Ready to close</p>
                  <h2 className="font-display text-2xl font-bold text-ghost-text">Start a call session</h2>
                  <p className="text-ghost-sub text-sm mt-1">
                    Ghost will handle objections in {activeProfile.name}'s voice.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDemo(true)}
                    className="py-3 px-4 rounded-xl border border-ghost-border text-ghost-sub hover:text-ghost-text hover:border-ghost-muted transition-all font-mono text-sm flex items-center gap-2"
                  >
                    <Play size={14} /> Demo Check
                  </button>
                  <button
                    onClick={() => navigate('/call')}
                    className="btn-ghost px-6 py-3 rounded-xl flex items-center gap-2 font-display text-sm shrink-0"
                  >
                    <Zap size={16} /> Launch Ghost
                  </button>
                </div>
              </div>
            )}

            {/* Profiles */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-ghost-text">
                Voice Profiles
                <span className="ml-2 font-mono text-xs text-ghost-dim">({profiles.length}/3)</span>
              </h2>
              {canAddProfile() && (
                <button
                  onClick={() => navigate('/onboarding')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ghost-border text-ghost-sub hover:text-ghost-text hover:border-ghost-muted transition-all text-sm font-mono"
                >
                  <Plus size={14} /> Add Profile
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
              {profiles.map(p => (
                <ProfileCard
                  key={p.id}
                  profile={p}
                  isActive={p.id === activeProfileId}
                  onActivate={() => setActiveProfile(p.id)}
                  onDelete={removeProfile}
                />
              ))}
            </div>

            {/* System status */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={14} className="text-ghost-sub" />
                <span className="font-mono text-xs text-ghost-sub uppercase tracking-widest">System Status</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {serverStatus?.env && Object.entries(serverStatus.env).map(([key, val]) => (
                  <StatusPill key={key} label={key} ok={!!val} value={typeof val === 'string' ? val.slice(0, 20) : null} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-slide-up">
      <div className="w-24 h-24 rounded-2xl bg-ghost-card border border-ghost-border flex items-center justify-center mb-6">
        <span className="font-display text-4xl font-bold text-gradient">G</span>
      </div>
      <h1 className="font-display text-4xl font-bold text-ghost-text mb-3">No profiles yet.</h1>
      <p className="text-ghost-sub max-w-sm leading-relaxed mb-8">
        Create your first voice profile. Ghost will clone your voice and use it to handle objections live.
      </p>
      <button onClick={onAdd} className="btn-ghost px-8 py-4 rounded-xl flex items-center gap-2 font-display text-base">
        <Plus size={18} /> Create First Profile
      </button>
    </div>
  );
}

function StatusPill({ label, ok, value }) {
  return (
    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-ghost-surface border border-ghost-border">
      <span className="font-mono text-ghost-dim text-xs uppercase">{label}</span>
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-ghost-green' : 'bg-ghost-accent'}`} />
        <span className={`font-mono text-xs ${ok ? 'text-ghost-green' : 'text-ghost-accent'}`}>
          {value || (ok ? 'configured' : 'missing')}
        </span>
      </div>
    </div>
  );
}
