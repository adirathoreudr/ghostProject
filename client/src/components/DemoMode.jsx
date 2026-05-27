import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, Loader2, X, ChevronRight, Zap } from 'lucide-react';
import { useProfileStore } from '../stores/profileStore.js';
import { api } from '../lib/api.js';

const STEPS = [
  { id: 'profile',  label: 'Active voice profile',        check: 'Has voice_id set' },
  { id: 'server',   label: 'Server health',                check: 'GET /api/health returns ok' },
  { id: 'keys',     label: 'API keys configured',          check: 'ElevenLabs + NVIDIA present' },
  { id: 'mic',      label: 'Microphone accessible',        check: 'getUserMedia succeeds' },
  { id: 'tts',      label: 'TTS voice clone reachable',    check: 'Test TTS responds' },
  { id: 'prewarm',  label: 'Pre-warm cache loaded',        check: '/api/ghost/prewarm succeeds' },
];

export function DemoMode({ onClose }) {
  const navigate = useNavigate();
  const { profiles, activeProfileId } = useProfileStore();
  const activeProfile = profiles.find(p => p.id === activeProfileId);

  const [results, setResults]   = useState({});
  const [running, setRunning]   = useState(false);
  const [done, setDone]         = useState(false);
  const [currentStep, setCurrent] = useState(null);

  const setResult = (id, status, msg = '') =>
    setResults(r => ({ ...r, [id]: { status, msg } }));

  async function runChecks() {
    setRunning(true);
    setResults({});
    setDone(false);

    // 1. Profile check
    setCurrent('profile');
    await delay(300);
    if (!activeProfile?.voice_id) {
      setResult('profile', 'fail', 'No active profile. Complete onboarding first.');
      setRunning(false); return;
    }
    setResult('profile', 'pass', `${activeProfile.name} · ${activeProfile.voice_id.slice(0,12)}…`);

    // 2. Server health
    setCurrent('server');
    try {
      const h = await fetch('/api/health').then(r => r.json());
      if (h.status !== 'ok') throw new Error('Server not ok');
      setResult('server', 'pass', 'Server online');
    } catch (err) {
      setResult('server', 'fail', 'Server not reachable. Run npm run dev.');
      setRunning(false); return;
    }

    // 3. API keys
    setCurrent('keys');
    try {
      const h = await fetch('/api/health').then(r => r.json());
      const missing = [];
      if (!h.env?.elevenlabs) missing.push('ELEVENLABS_API_KEY');
      if (!h.env?.nvidia)     missing.push('NVIDIA_API_KEY');
      if (missing.length) throw new Error(missing.join(', ') + ' missing');
      setResult('keys', 'pass', 'ElevenLabs + NVIDIA configured');
    } catch (err) {
      setResult('keys', 'fail', err.message);
      setRunning(false); return;
    }

    // 4. Microphone
    setCurrent('mic');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setResult('mic', 'pass', 'Microphone accessible');
    } catch (err) {
      setResult('mic', 'fail', `Mic denied: ${err.message}`);
      setRunning(false); return;
    }

    // 5. TTS voice clone test
    setCurrent('tts');
    try {
      const url = `/api/voice/test-tts/${activeProfile.voice_id}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`TTS returned ${res.status}`);
      // Just check headers arrive — don't play audio
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('audio')) throw new Error('Non-audio response');
      setResult('tts', 'pass', 'Voice clone reachable');
    } catch (err) {
      setResult('tts', 'warn', `TTS check failed: ${err.message} — may still work live`);
    }

    // 6. Prewarm
    setCurrent('prewarm');
    try {
      const res = await fetch('/api/ghost/prewarm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_id: activeProfile.voice_id, persona: activeProfile.persona || 'hormozi' }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      const ok = data.results?.filter(r => r.ok).length || 0;
      const total = data.results?.length || 0;
      if (ok === 0) throw new Error('All pre-warm requests failed');
      setResult('prewarm', ok === total ? 'pass' : 'warn',
        `${ok}/${total} responses cached — latency will be lower`);
    } catch (err) {
      setResult('prewarm', 'warn', `Pre-warm failed (non-blocking): ${err.message}`);
    }

    setCurrent(null);
    setRunning(false);
    setDone(true);
  }

  const allPassed = done && Object.values(results).every(r => r.status !== 'fail');
  const hasFails  = Object.values(results).some(r => r.status === 'fail');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(8,8,16,0.92)', backdropFilter: 'blur(16px)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-ghost-border overflow-hidden animate-slide-up"
        style={{ background: 'rgba(13,13,26,0.99)', boxShadow: '0 0 80px rgba(233,69,96,0.1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ghost-border">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-ghost-accent" />
            <span className="font-display font-bold text-ghost-text">Demo Run-Through</span>
          </div>
          <button onClick={onClose} className="text-ghost-dim hover:text-ghost-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 space-y-3">
          <p className="text-ghost-sub text-sm mb-4">
            Verifies your setup is demo-ready. Run this before going live with judges.
          </p>

          {STEPS.map((step) => {
            const result = results[step.id];
            const isCurrent = currentStep === step.id && running;
            return (
              <div key={step.id} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {isCurrent ? (
                    <Loader2 size={16} className="text-ghost-cyan animate-spin" />
                  ) : result?.status === 'pass' ? (
                    <CheckCircle2 size={16} className="text-ghost-green" />
                  ) : result?.status === 'warn' ? (
                    <CheckCircle2 size={16} className="text-ghost-gold" />
                  ) : result?.status === 'fail' ? (
                    <X size={16} className="text-ghost-accent" />
                  ) : (
                    <Circle size={16} className="text-ghost-border" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-mono ${
                    result?.status === 'pass' ? 'text-ghost-text' :
                    result?.status === 'warn' ? 'text-ghost-gold' :
                    result?.status === 'fail' ? 'text-ghost-accent' :
                    isCurrent ? 'text-ghost-cyan' : 'text-ghost-dim'
                  }`}>
                    {step.label}
                  </p>
                  {result?.msg && (
                    <p className="text-xs text-ghost-dim font-mono mt-0.5 truncate">{result.msg}</p>
                  )}
                  {!result && !isCurrent && (
                    <p className="text-xs text-ghost-dim/50 font-mono mt-0.5">{step.check}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3">
          {!running && !done && (
            <button
              onClick={runChecks}
              className="btn-ghost flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-display text-sm"
            >
              <Zap size={14} /> Run Checks
            </button>
          )}

          {running && (
            <div className="flex-1 py-3 rounded-xl bg-ghost-surface border border-ghost-border flex items-center justify-center gap-2">
              <Loader2 size={14} className="text-ghost-cyan animate-spin" />
              <span className="font-mono text-sm text-ghost-cyan">Checking…</span>
            </div>
          )}

          {done && allPassed && (
            <button
              onClick={() => { onClose(); navigate('/call'); }}
              className="btn-ghost flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-display text-sm"
            >
              Launch Ghost <ChevronRight size={14} />
            </button>
          )}

          {done && hasFails && (
            <button
              onClick={runChecks}
              className="flex-1 py-3 rounded-xl border border-ghost-border text-ghost-sub hover:text-ghost-text font-mono text-sm transition-all"
            >
              Re-run
            </button>
          )}

          {done && (
            <button
              onClick={() => { onClose(); navigate('/call'); }}
              className={`py-3 px-5 rounded-xl border font-mono text-sm transition-all ${
                hasFails
                  ? 'border-ghost-accent/40 text-ghost-accent hover:bg-ghost-accent/10'
                  : 'border-ghost-border text-ghost-dim hover:text-ghost-text'
              }`}
            >
              {hasFails ? 'Launch Anyway' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
