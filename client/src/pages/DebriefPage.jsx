import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, RotateCcw, Zap, Clock, TrendingUp } from 'lucide-react';
import { GhostLogo } from '../components/GhostLogo.jsx';
import { useGhostStore, OBJECTION_META } from '../stores/ghostStore.js';
import { useProfileStore, PERSONAS_MAP } from '../stores/profileStore.js';

export default function DebriefPage() {
  const navigate = useNavigate();
  const { sessionLog, conversationId, callStartTime, clearSession } = useGhostStore();
  const { profiles, activeProfileId } = useProfileStore();
  const activeProfile = profiles.find(p => p.id === activeProfileId);

  const [summary, setSummary]         = useState(null);
  const [summarySource, setSummarySource] = useState(null);
  const [loadingSummary, setLoading]   = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // Redirect if no session data
  useEffect(() => {
    if (!sessionLog || sessionLog.length === 0) {
      navigate('/');
    }
  }, []);

  // Fetch AI summary on mount
  useEffect(() => {
    if (sessionLog?.length > 0 && activeProfile) {
      fetchSummary();
    }
  }, []);

  async function fetchSummary() {
    setLoading(true);
    setSummaryError(null);
    try {
      const res = await fetch('/api/debrief/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionLog,
          repName: activeProfile?.name || 'Rep',
          conversationId,
          persona: activeProfile?.persona || 'hormozi',
        }),
      });
      const data = await res.json();
      setSummary(data.summary || []);
      setSummarySource(data.source || 'fallback');
    } catch (err) {
      setSummaryError('Summary unavailable — check NVIDIA API key');
      setSummary([
        `${sessionLog.length} objection${sessionLog.length !== 1 ? 's' : ''} handled this session.`,
        'Review the objection log below for full detail.',
        'Run Ghost again to build a complete performance history.',
      ]);
      setSummarySource('fallback');
    } finally {
      setLoading(false);
    }
  }

  if (!sessionLog?.length) return null;

  const callDurationMs  = callStartTime ? Date.now() - callStartTime : 0;
  const callDurationMin = Math.floor(callDurationMs / 60000);
  const callDurationSec = Math.floor((callDurationMs % 60000) / 1000);
  const avgLatency      = Math.round(sessionLog.reduce((s, e) => s + (e.latencyMs || 0), 0) / sessionLog.length);
  const objTypes        = [...new Set(sessionLog.map(e => e.objectionType))];
  const persona         = PERSONAS_MAP[activeProfile?.persona] || PERSONAS_MAP.hormozi;

  function handleNewCall() {
    clearSession();
    navigate('/call');
  }

  function handleHome() {
    clearSession();
    navigate('/');
  }

  function exportJSON() {
    const data = {
      conversationId,
      repName: activeProfile?.name,
      persona: activeProfile?.persona,
      callStart: new Date(callStartTime).toISOString(),
      sessionLog,
      summary,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghost-debrief-${conversationId?.slice(0, 8) || 'session'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-ghost-black">

      {/* Header */}
      <header
        className="border-b border-ghost-border px-6 py-4 flex items-center justify-between sticky top-0 z-40"
        style={{ background: 'rgba(8,8,16,0.97)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-4">
          <button onClick={handleHome} className="text-ghost-dim hover:text-ghost-sub transition-colors">
            <ArrowLeft size={14} />
          </button>
          <GhostLogo size="sm" showTagline={false} />
          <span className="font-mono text-xs text-ghost-dim border-l border-ghost-border pl-4">Call Debrief</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ghost-border text-ghost-dim hover:text-ghost-text hover:border-ghost-muted transition-all font-mono text-xs"
          >
            <Download size={12} /> Export JSON
          </button>
          <button
            onClick={handleNewCall}
            className="btn-ghost px-4 py-1.5 rounded-lg flex items-center gap-1.5 font-mono text-xs"
          >
            <RotateCcw size={12} /> New Call
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* ── Stats row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Zap size={16} className="text-ghost-accent" />}
            label="Objections Handled"
            value={sessionLog.length}
            color="#e94560"
          />
          <StatCard
            icon={<Clock size={16} className="text-ghost-cyan" />}
            label="Avg Response"
            value={`${avgLatency}ms`}
            color="#00d4ff"
          />
          <StatCard
            icon={<TrendingUp size={16} className="text-ghost-green" />}
            label="Call Duration"
            value={callDurationMin > 0 ? `${callDurationMin}m ${callDurationSec}s` : `${callDurationSec}s`}
            color="#00ff88"
          />
          <StatCard
            icon={<div className="w-2 h-2 rounded-full" style={{ background: persona.color }} />}
            label="Coach Persona"
            value={persona.name.split(' ')[0]}
            color={persona.color}
          />
        </div>

        {/* ── AI Summary ────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-ghost-text text-lg">Call Summary</h2>
            <div className="flex items-center gap-2">
              {summarySource === 'llm' && (
                <span className="font-mono text-xs text-ghost-green px-2 py-0.5 rounded bg-ghost-green/10 border border-ghost-green/20">
                  AI Generated
                </span>
              )}
              {summarySource === 'fallback' && (
                <span className="font-mono text-xs text-ghost-gold px-2 py-0.5 rounded bg-ghost-gold/10 border border-ghost-gold/20">
                  Auto Summary
                </span>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            {loadingSummary ? (
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-ghost-accent"
                      style={{ animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />
                  ))}
                </div>
                <span className="text-ghost-sub text-sm font-mono">Generating summary…</span>
              </div>
            ) : summary ? (
              <ul className="space-y-4">
                {summary.filter(Boolean).map((bullet, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-mono text-xs font-bold"
                      style={{ background: 'rgba(233,69,96,0.15)', color: '#e94560', border: '1px solid rgba(233,69,96,0.3)' }}
                    >
                      {i + 1}
                    </div>
                    <p className="text-ghost-text text-sm leading-relaxed">{bullet}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ghost-dim text-sm font-mono">{summaryError || 'No summary available.'}</p>
            )}
          </div>
        </section>

        {/* ── Objection Log ─────────────────────────────────────── */}
        <section>
          <h2 className="font-display font-bold text-ghost-text text-lg mb-4">Objection Log</h2>
          <div className="glass rounded-2xl overflow-hidden">

            {/* Table header */}
            <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-ghost-border bg-ghost-surface">
              <span className="col-span-1 font-mono text-xs text-ghost-dim uppercase">#</span>
              <span className="col-span-2 font-mono text-xs text-ghost-dim uppercase">Type</span>
              <span className="col-span-4 font-mono text-xs text-ghost-dim uppercase">Prospect said</span>
              <span className="col-span-4 font-mono text-xs text-ghost-dim uppercase">Ghost responded</span>
              <span className="col-span-1 font-mono text-xs text-ghost-dim uppercase text-right">ms</span>
            </div>

            {sessionLog.map((entry, i) => {
              const meta = OBJECTION_META[entry.objectionType] || { label: entry.objectionType, color: '#888' };
              return (
                <div
                  key={entry.id}
                  className="grid grid-cols-12 gap-3 px-5 py-4 border-b border-ghost-border/50 last:border-0 hover:bg-ghost-surface/50 transition-colors"
                >
                  <div className="col-span-1 font-mono text-xs text-ghost-dim mt-0.5">{i + 1}</div>

                  <div className="col-span-2">
                    <span
                      className="px-2 py-0.5 rounded font-mono text-xs font-semibold"
                      style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}30` }}
                    >
                      {meta.label}
                    </span>
                    <div className="text-ghost-dim/60 text-xs font-mono mt-1">
                      {(entry.confidence * 100).toFixed(0)}%
                    </div>
                  </div>

                  <div className="col-span-4">
                    <p className="text-ghost-sub text-xs italic leading-relaxed">
                      "{entry.transcript?.slice(0, 100)}{entry.transcript?.length > 100 ? '…' : ''}"
                    </p>
                  </div>

                  <div className="col-span-4">
                    <p className="text-ghost-text text-xs leading-relaxed">
                      "{entry.responseText?.slice(0, 120)}{entry.responseText?.length > 120 ? '…' : ''}"
                    </p>
                  </div>

                  <div className="col-span-1 text-right">
                    <span className="font-mono text-xs text-ghost-dim">{entry.latencyMs}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Objection type breakdown ──────────────────────────── */}
        {objTypes.length > 1 && (
          <section>
            <h2 className="font-display font-bold text-ghost-text text-lg mb-4">Objection Breakdown</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(OBJECTION_META).map(([key, meta]) => {
                const count = sessionLog.filter(e => e.objectionType === key).length;
                const pct = sessionLog.length ? Math.round((count / sessionLog.length) * 100) : 0;
                return (
                  <div
                    key={key}
                    className="glass rounded-xl p-4 text-center"
                    style={{ borderColor: count > 0 ? `${meta.color}30` : undefined }}
                  >
                    <div
                      className="text-2xl font-display font-bold mb-1"
                      style={{ color: count > 0 ? meta.color : '#555570' }}
                    >
                      {count}
                    </div>
                    <div className="font-mono text-xs text-ghost-sub">{meta.label}</div>
                    {count > 0 && (
                      <div className="font-mono text-xs text-ghost-dim mt-1">{pct}%</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Session meta ──────────────────────────────────────── */}
        <div className="glass rounded-xl p-4 font-mono text-xs text-ghost-dim space-y-1">
          <p>conversation_id: <span className="text-ghost-sub">{conversationId || 'n/a'}</span></p>
          <p>rep: <span className="text-ghost-sub">{activeProfile?.name || 'unknown'}</span></p>
          <p>persona: <span className="text-ghost-sub">{activeProfile?.persona || 'hormozi'}</span></p>
          <p>voice_id: <span className="text-ghost-sub">{activeProfile?.voice_id?.slice(0, 20) || 'n/a'}…</span></p>
        </div>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <div className="flex gap-4 pb-8">
          <button
            onClick={handleNewCall}
            className="btn-ghost flex-1 py-4 rounded-xl flex items-center justify-center gap-2 font-display text-base"
          >
            <RotateCcw size={16} /> Start New Call
          </button>
          <button
            onClick={handleHome}
            className="py-4 px-8 rounded-xl border border-ghost-border text-ghost-sub hover:text-ghost-text hover:border-ghost-muted transition-all font-mono text-sm"
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="font-mono text-xs text-ghost-dim uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-display font-bold text-2xl" style={{ color }}>{value}</p>
    </div>
  );
}
