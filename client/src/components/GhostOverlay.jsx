import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Zap, AlertCircle, ChevronDown, Volume2 } from 'lucide-react';
import { OBJECTION_META } from '../stores/ghostStore.js';
import { PERSONAS_MAP } from '../stores/profileStore.js';
import { LiveCaptions } from './LiveCaptions.jsx';

export function GhostOverlay({
  profile, status, transcript, objectionType, confidence,
  responseText, errorMsg, latencyMs, sessionLog,
  captionTokens, captionFinal, onClose, onPersonaChange,
}) {
  const [showLog, setShowLog] = useState(false);
  const objMeta  = objectionType ? OBJECTION_META[objectionType] : null;
  const persona  = PERSONAS_MAP[profile?.persona] || PERSONAS_MAP.hormozi;
  const isActive = status !== 'idle' && status !== 'error';
  const prevStatus = useRef(status);

  // Pulse the overlay border on state change
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prevStatus.current !== status && status === 'speaking') {
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
    }
    prevStatus.current = status;
  }, [status]);

  const borderColor =
    status === 'listening'  ? 'rgba(233,69,96,0.7)' :
    status === 'processing' ? 'rgba(0,212,255,0.7)' :
    status === 'speaking'   ? 'rgba(0,255,136,0.7)' :
    status === 'error'      ? 'rgba(233,69,96,0.5)' :
                              'rgba(30,30,53,0.8)';

  const glowColor =
    status === 'listening'  ? 'rgba(233,69,96,0.18)' :
    status === 'processing' ? 'rgba(0,212,255,0.12)' :
    status === 'speaking'   ? 'rgba(0,255,136,0.15)' : 'transparent';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-6 px-4" style={{ pointerEvents: 'none' }}>

      {/* Full screen ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none transition-all duration-700"
        style={{ background: isActive ? `radial-gradient(ellipse at bottom center, ${glowColor} 0%, transparent 65%)` : 'transparent' }}
      />

      {/* Scan line effect during speaking */}
      {status === 'speaking' && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-5">
          <div className="w-full h-px bg-ghost-green animate-scan" />
        </div>
      )}

      {/* Main panel */}
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden transition-all duration-300"
        style={{
          pointerEvents: 'all',
          background: 'rgba(10,10,20,0.97)',
          backdropFilter: 'blur(28px)',
          border: `1px solid ${borderColor}`,
          boxShadow: isActive
            ? `0 0 0 1px ${borderColor}, 0 8px 80px ${glowColor}, 0 2px 20px rgba(0,0,0,0.8)`
            : '0 8px 40px rgba(0,0,0,0.7)',
          transform: flash ? 'scale(1.002)' : 'scale(1)',
        }}
      >
        {/* ── Top status bar ──────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-2.5"
          style={{ borderBottom: `1px solid ${borderColor}`, background: 'rgba(0,0,0,0.3)' }}
        >
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <StatusDot status={status} />
            <span className={`font-mono text-xs tracking-[0.15em] uppercase transition-colors duration-300 ${
              status === 'listening'  ? 'text-ghost-accent' :
              status === 'processing' ? 'text-ghost-cyan' :
              status === 'speaking'   ? 'text-ghost-green' :
              status === 'error'      ? 'text-ghost-accent' : 'text-ghost-dim'
            }`}>
              {status === 'idle'       ? 'Standing By' :
               status === 'listening'  ? '⬤  Capturing' :
               status === 'processing' ? '◎  Processing' :
               status === 'speaking'   ? '▶  Speaking' :
               status === 'error'      ? '✕  Error' : status}
            </span>

            {latencyMs && status !== 'idle' && (
              <span className="font-mono text-xs text-ghost-dim bg-ghost-surface border border-ghost-border px-1.5 py-0.5 rounded">
                {latencyMs}ms
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Persona badge */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-xs"
              style={{ borderColor: `${persona.color}35`, color: persona.color, background: `${persona.color}0d` }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: persona.color }} />
              {persona.name.split(' ')[0]}
            </div>

            <span className="text-ghost-dim font-mono text-xs">{profile?.name}</span>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-ghost-dim hover:text-ghost-accent hover:bg-ghost-surface transition-all"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* ── Main content ────────────────────────────────────────── */}
        <div className="px-5 py-4 space-y-3">

          {/* IDLE — spacebar prompt */}
          {status === 'idle' && !responseText && (
            <div className="flex items-center justify-center py-3">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-8 rounded-lg border-2 border-ghost-border flex items-center justify-center"
                  style={{ background: 'rgba(233,69,96,0.04)' }}
                >
                  <span className="font-mono text-ghost-dim text-xs font-bold">SPC</span>
                </div>
                <p className="text-ghost-sub text-sm">Hold spacebar when you hear an objection</p>
              </div>
            </div>
          )}

          {/* IDLE after response — show last result */}
          {status === 'idle' && responseText && (
            <LastResult
              transcript={transcript}
              responseText={responseText}
              objMeta={objMeta}
              objectionType={objectionType}
              confidence={confidence}
            />
          )}

          {/* LISTENING */}
          {status === 'listening' && (
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(233,69,96,0.12)', border: '1px solid rgba(233,69,96,0.5)' }}
                >
                  <Mic size={18} className="text-ghost-accent" />
                </div>
                <div className="absolute -inset-1 rounded-xl border border-ghost-accent/30 animate-ping" />
              </div>
              <div className="flex-1">
                <p className="font-display font-semibold text-ghost-text text-sm mb-1">Capturing objection…</p>
                <p className="text-ghost-sub text-xs font-mono">Release SPACE when they finish speaking</p>
              </div>
              <MiniWaveform active />
            </div>
          )}

          {/* PROCESSING */}
          {status === 'processing' && (
            <div className="flex items-center gap-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.4)' }}
              >
                <Zap size={18} className="text-ghost-cyan" />
              </div>
              <div className="flex-1">
                <p className="font-display font-semibold text-ghost-text text-sm mb-2">Ghost is responding…</p>
                <div className="flex items-center gap-3">
                  <PipelineStep label="Transcribe" done color="#00d4ff" />
                  <div className="flex-1 h-px bg-ghost-border" />
                  <PipelineStep label="Classify" active color="#00d4ff" />
                  <div className="flex-1 h-px bg-ghost-border" />
                  <PipelineStep label="Speak" color="#00ff88" />
                </div>
              </div>
            </div>
          )}

          {/* SPEAKING */}
          {status === 'speaking' && responseText && (
            <SpeakingCard
              transcript={transcript}
              responseText={responseText}
              objMeta={objMeta}
              objectionType={objectionType}
              confidence={confidence}
            />
          )}

          {/* ERROR */}
          {status === 'error' && errorMsg && (
            <div className="flex items-start gap-3">
              <AlertCircle size={16} className="text-ghost-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-ghost-accent font-semibold text-sm">Ghost encountered an error</p>
                <p className="text-red-300/80 text-xs mt-1 font-mono leading-relaxed">{errorMsg}</p>
                <button
                  onClick={onClose}
                  className="mt-2 text-xs font-mono text-ghost-dim hover:text-ghost-sub underline underline-offset-2"
                >
                  Dismiss → press SPACE to try again
                </button>
              </div>
            </div>
          )}

          {/* Live captions — always shown when active */}
          {(status === 'listening' || status === 'processing' || (status === 'speaking' && transcript)) && (
            <LiveCaptions
              tokens={captionTokens || []}
              finalText={captionFinal || transcript}
              objectionType={objectionType}
              status={status}
            />
          )}
        </div>

        {/* ── Session log ─────────────────────────────────────────── */}
        {sessionLog?.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(30,30,53,0.8)' }}>
            <button
              onClick={() => setShowLog(!showLog)}
              className="w-full px-5 py-2 flex items-center justify-between text-ghost-dim hover:text-ghost-sub transition-colors"
            >
              <span className="font-mono text-xs uppercase tracking-wider">
                {sessionLog.length} objection{sessionLog.length !== 1 ? 's' : ''} handled this session
              </span>
              <ChevronDown size={12} className={`transition-transform duration-200 ${showLog ? 'rotate-180' : ''}`} />
            </button>

            {showLog && (
              <div className="px-5 pb-4 space-y-1.5 max-h-36 overflow-y-auto">
                {[...sessionLog].reverse().map((entry) => {
                  const meta = OBJECTION_META[entry.objectionType];
                  return (
                    <div key={entry.id} className="flex items-center gap-2 py-1 border-b border-ghost-border/50 last:border-0">
                      <span
                        className="px-1.5 py-0.5 rounded font-mono text-xs shrink-0"
                        style={{ background: `${meta?.color}18`, color: meta?.color }}
                      >
                        {meta?.label || entry.objectionType}
                      </span>
                      <p className="text-ghost-dim text-xs truncate flex-1">{entry.transcript}</p>
                      <span className="text-ghost-dim/60 font-mono text-xs shrink-0">{entry.latencyMs}ms</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatusDot({ status }) {
  const color =
    status === 'listening'  ? '#e94560' :
    status === 'processing' ? '#00d4ff' :
    status === 'speaking'   ? '#00ff88' :
    status === 'error'      ? '#e94560' : '#555570';
  const pulse = status !== 'idle';

  return (
    <div className="relative w-2 h-2">
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      {pulse && (
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: color, opacity: 0.4 }}
        />
      )}
    </div>
  );
}

function MiniWaveform({ active }) {
  return (
    <div className="flex items-center gap-0.5 h-6">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="w-0.5 rounded-full bg-ghost-accent"
          style={{
            height: active ? `${8 + Math.random() * 16}px` : '4px',
            animation: active ? `waveBar ${0.4 + i * 0.08}s ease-in-out infinite alternate` : 'none',
            transition: 'height 0.1s ease',
          }}
        />
      ))}
    </div>
  );
}

function PipelineStep({ label, active, done, color }) {
  return (
    <div className="flex items-center gap-1">
      <div
        className={`w-1.5 h-1.5 rounded-full transition-all ${done ? '' : active ? 'animate-pulse' : ''}`}
        style={{ background: done || active ? color : '#2a2a45' }}
      />
      <span
        className="font-mono text-xs transition-colors"
        style={{ color: done || active ? color : '#555570' }}
      >
        {label}
      </span>
    </div>
  );
}

function SpeakingCard({ transcript, responseText, objMeta, objectionType, confidence }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        {objMeta && (
          <span
            className="px-2 py-0.5 rounded font-mono text-xs font-semibold uppercase tracking-wide"
            style={{ background: `${objMeta.color}18`, color: objMeta.color, border: `1px solid ${objMeta.color}35` }}
          >
            {objMeta.label}
          </span>
        )}
        {confidence != null && (
          <span className="text-ghost-dim text-xs font-mono">{(confidence * 100).toFixed(0)}%</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Volume2 size={12} className="text-ghost-green" />
          <span className="text-ghost-green text-xs font-mono animate-pulse">SPEAKING IN YOUR VOICE</span>
        </div>
      </div>

      {transcript && (
        <div className="mb-2.5 px-3 py-2 rounded-lg bg-ghost-surface border border-ghost-border">
          <p className="text-ghost-dim text-xs font-mono uppercase tracking-wider mb-1">Prospect:</p>
          <p className="text-ghost-sub text-sm italic">"{transcript}"</p>
        </div>
      )}

      <div
        className="px-4 py-3 rounded-xl"
        style={{
          background: `${objMeta?.color || '#e94560'}08`,
          borderLeft: `3px solid ${objMeta?.color || '#e94560'}`,
          border: `1px solid ${objMeta?.color || '#e94560'}22`,
          borderLeftWidth: '3px',
        }}
      >
        <p className="text-ghost-dim text-xs font-mono uppercase tracking-wider mb-1.5">Ghost:</p>
        <p className="text-ghost-text text-sm leading-relaxed">"{responseText}"</p>
      </div>
    </div>
  );
}

function LastResult({ transcript, responseText, objMeta, objectionType, confidence }) {
  return (
    <div className="opacity-75">
      <div className="flex items-center gap-2 mb-2">
        {objMeta && (
          <span className="font-mono text-xs text-ghost-dim">Last: </span>
        )}
        {objMeta && (
          <span
            className="px-1.5 py-0.5 rounded font-mono text-xs"
            style={{ background: `${objMeta.color}15`, color: objMeta.color }}
          >
            {objMeta.label}
          </span>
        )}
        <span className="text-ghost-dim/60 text-xs font-mono ml-auto">Press SPACE for next</span>
      </div>
      {responseText && (
        <p className="text-ghost-sub/70 text-xs italic truncate">"{responseText.slice(0, 80)}…"</p>
      )}
    </div>
  );
}
