import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Square, Zap } from 'lucide-react';
import { GhostLogo } from '../components/GhostLogo.jsx';
import { GhostOverlay } from '../components/GhostOverlay.jsx';
import { PersonaSelector } from '../components/PersonaSelector.jsx';
import { AudioDeviceSelector } from '../components/AudioDeviceSelector.jsx';
import { useGhostTakeover } from '../hooks/useGhostTakeover.js';
import { useProfileStore, PERSONAS_MAP } from '../stores/profileStore.js';
import { useGhostStore, OBJECTION_META } from '../stores/ghostStore.js';

export default function CallPage() {
  const navigate = useNavigate();
  const { profiles, activeProfileId, updateProfile } = useProfileStore();
  const { clearSession, startSession, setPrewarmCache, setPrewarmStatus, prewarmStatus } = useGhostStore();

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  const {
    status, transcript, objectionType, confidence,
    responseText, errorMsg, latencyMs, sessionLog,
    captionTokens, captionFinal,
  } = useGhostTakeover(activeProfile);

  useEffect(() => {
    startSession();
    if (activeProfile?.voice_id) {
      prewarmVoice(activeProfile.voice_id, activeProfile.persona || 'hormozi', setPrewarmCache, setPrewarmStatus);
    }
  }, []);

  const handleEndCall = () => {
    const log = useGhostStore.getState().sessionLog;
    if (log.length > 0) navigate('/debrief');
    else { clearSession(); navigate('/'); }
  };

  const handlePersonaChange = (id) => {
    if (activeProfile) updateProfile(activeProfile.id, { persona: id });
  };

  if (!activeProfile) {
    return (
      <div className="min-h-screen bg-ghost-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-ghost-sub mb-4">No active profile.</p>
          <button onClick={() => navigate('/')} className="btn-ghost px-6 py-3 rounded-xl font-display">Back</button>
        </div>
      </div>
    );
  }

  const persona = PERSONAS_MAP[activeProfile.persona] || PERSONAS_MAP.hormozi;

  return (
    <div className="min-h-screen bg-ghost-black flex flex-col select-none">

      {/* Top bar */}
      <header
        className="border-b border-ghost-border px-6 py-3 flex items-center justify-between sticky top-0 z-40"
        style={{ background: 'rgba(8,8,16,0.98)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-4">
          <button onClick={() => { clearSession(); navigate('/'); }} className="text-ghost-dim hover:text-ghost-sub transition-colors">
            <ArrowLeft size={14} />
          </button>
          <GhostLogo size="sm" showTagline={false} />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ghost-surface border border-ghost-border">
            <div className="w-1.5 h-1.5 rounded-full bg-ghost-green animate-pulse" />
            <span className="font-mono text-xs text-ghost-green">LIVE SESSION</span>
          </div>

          {prewarmStatus === 'loading' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ghost-surface border border-ghost-border">
              <Zap size={10} className="text-ghost-gold animate-pulse" />
              <span className="font-mono text-xs text-ghost-gold">Warming up…</span>
            </div>
          )}
          {prewarmStatus === 'ready' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ghost-surface border border-ghost-border">
              <Zap size={10} className="text-ghost-green" />
              <span className="font-mono text-xs text-ghost-green">Cache ready</span>
            </div>
          )}

          {sessionLog.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ghost-surface border border-ghost-border">
              <span className="font-mono text-xs text-ghost-sub">{sessionLog.length} handled</span>
            </div>
          )}

          <button
            onClick={handleEndCall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-800/50 text-ghost-accent hover:bg-red-950/30 transition-all font-mono text-xs"
          >
            <Square size={10} fill="currentColor" /> End Call
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">

        {/* Sidebar */}
        <aside className="w-72 border-r border-ghost-border p-5 flex flex-col gap-5 overflow-y-auto">
          <div>
            <p className="font-mono text-xs text-ghost-dim uppercase tracking-widest mb-3">Active Rep</p>
            <div className="flex items-center gap-3 p-3 rounded-xl border bg-ghost-card" style={{ borderColor: `${persona.color}30` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-lg shrink-0"
                style={{ background: `${persona.color}15`, color: persona.color }}>
                {activeProfile.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-display font-semibold text-ghost-text text-sm">{activeProfile.name}</p>
                <p className="font-mono text-xs text-ghost-dim">{activeProfile.voice_id.slice(0, 14)}…</p>
              </div>
            </div>
          </div>

          <div>
            <p className="font-mono text-xs text-ghost-dim uppercase tracking-widest mb-3">Coach Persona</p>
            <PersonaSelector selected={activeProfile.persona} onSelect={handlePersonaChange} />
            <p className="text-ghost-dim text-xs mt-2 font-mono">Persona = style. Voice = always yours.</p>
          </div>

          <div>
            <p className="font-mono text-xs text-ghost-dim uppercase tracking-widest mb-3">Audio Output</p>
            <AudioDeviceSelector />
            <p className="text-ghost-dim text-xs mt-2 font-mono leading-relaxed">
              Select BlackHole 2ch to route Ghost into your call.
            </p>
          </div>

          <div className="flex-1" />

          <div className="p-3 rounded-xl bg-ghost-surface border border-ghost-border">
            <p className="font-mono text-xs text-ghost-dim uppercase tracking-widest mb-2">Objection Types</p>
            <div className="space-y-1">
              {Object.entries(OBJECTION_META).map(([key, meta]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
                  <span className="font-mono text-xs text-ghost-sub">{meta.label}</span>
                  <span className="text-ghost-dim/60 text-xs ml-auto">{meta.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-ghost-surface border border-ghost-border">
            <p className="font-mono text-xs text-ghost-dim uppercase tracking-widest mb-2">Controls</p>
            <div className="space-y-1.5">
              <KeyGuide keys="SPACE hold"    action="Capture objection" />
              <KeyGuide keys="SPACE release" action="Process + respond" />
              <KeyGuide keys="ESC"           action="Emergency cancel" />
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: 'linear-gradient(rgba(233,69,96,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(233,69,96,0.5) 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }} />

          <div className="w-full max-w-xl relative z-10">
            {status === 'idle' && sessionLog.length === 0 && (
              <div className="text-center animate-slide-up">
                <div className="w-28 h-28 rounded-3xl border border-ghost-border flex flex-col items-center justify-center mx-auto mb-8 relative"
                  style={{ background: 'rgba(233,69,96,0.04)' }}>
                  <span className="font-display font-bold text-5xl text-gradient">G</span>
                  <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-ghost-accent rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-ghost-accent rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-ghost-accent rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-ghost-accent rounded-br-lg" />
                </div>
                <h2 className="font-display text-3xl font-bold text-ghost-text mb-3">Ghost is standing by.</h2>
                <p className="text-ghost-sub leading-relaxed mb-6 max-w-sm mx-auto">
                  When you hear an objection, hold{' '}
                  <kbd className="px-2 py-0.5 rounded bg-ghost-card border border-ghost-border text-ghost-text font-mono text-sm">SPACE</kbd>.
                  {' '}Release when they finish. Ghost responds in your voice.
                </p>
                <div className="flex items-center justify-center gap-6 text-sm text-ghost-dim font-mono">
                  <span>Coach: <span style={{ color: persona.color }}>{persona.name}</span></span>
                  <span>·</span>
                  <span>Voice: {activeProfile.name}</span>
                </div>
              </div>
            )}

            {status === 'idle' && sessionLog.length > 0 && (
              <div className="text-center animate-slide-up">
                <p className="text-ghost-sub text-sm font-mono mb-3">Last handled</p>
                <div className="glass rounded-2xl p-5 text-left mb-4">
                  <p className="text-ghost-dim text-xs mb-1 font-mono uppercase">Prospect said:</p>
                  <p className="text-ghost-sub italic mb-3 text-sm">"{sessionLog.at(-1).transcript}"</p>
                  <p className="text-ghost-dim text-xs mb-1 font-mono uppercase">Ghost responded:</p>
                  <p className="text-ghost-text text-sm">"{sessionLog.at(-1).responseText}"</p>
                </div>
                <p className="text-ghost-dim text-xs font-mono">Hold SPACE for the next one</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <GhostOverlay
        profile={activeProfile}
        status={status}
        transcript={transcript}
        objectionType={objectionType}
        confidence={confidence}
        responseText={responseText}
        errorMsg={errorMsg}
        latencyMs={latencyMs}
        sessionLog={sessionLog}
        captionTokens={captionTokens}
        captionFinal={captionFinal}
        onClose={handleEndCall}
        onPersonaChange={handlePersonaChange}
      />
    </div>
  );
}

function KeyGuide({ keys, action }) {
  return (
    <div className="flex items-center justify-between">
      <kbd className="px-1.5 py-0.5 rounded bg-ghost-card border border-ghost-border text-ghost-sub font-mono text-xs">{keys}</kbd>
      <span className="text-ghost-dim text-xs">{action}</span>
    </div>
  );
}

// ── Prewarm — fetches base64 audio blobs and caches them client-side ────────
async function prewarmVoice(voice_id, persona, setPrewarmCache, setPrewarmStatus) {
  setPrewarmStatus('loading');
  console.log('[Prewarm] Starting for voice:', voice_id);

  try {
    const res = await fetch('/api/ghost/prewarm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voice_id, persona }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) { setPrewarmStatus('failed'); return; }

    const data = await res.json();
    const ok = data.results?.filter(r => r.ok).length || 0;
    console.log(`[Prewarm] ${ok}/${data.results?.length || 0} cached`);

    // Convert base64 strings → Blob objects for instant playback
    const blobCache = {};
    if (data.audioCache) {
      for (const [objType, b64] of Object.entries(data.audioCache)) {
        try {
          const binary = atob(b64);
          const bytes  = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          blobCache[objType] = new Blob([bytes], { type: 'audio/mpeg' });
          console.log(`[Prewarm] Blob cached for: ${objType}`);
        } catch (e) {
          console.warn(`[Prewarm] Blob decode failed for ${objType}:`, e.message);
        }
      }
    }

    setPrewarmCache(blobCache);
    setPrewarmStatus('ready');
  } catch (err) {
    console.warn('[Prewarm] Failed (non-blocking):', err.message);
    setPrewarmStatus('failed');
  }
}
