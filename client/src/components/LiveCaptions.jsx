import React, { useRef, useEffect, useState } from 'react';
import { OBJECTION_META } from '../stores/ghostStore.js';

const OBJECTION_KEYWORDS = {
  stall:      ['think', 'thought', 'later', 'back', 'busy', 'now', 'time', 'ready', 'sure'],
  price:      ['expensive', 'cost', 'price', 'budget', 'afford', 'cheap', 'money', 'pay'],
  authority:  ['wife', 'husband', 'partner', 'boss', 'team', 'manager', 'approve', 'check', 'ask'],
  timing:     ['quarter', 'year', 'month', 'period', 'soon', 'later', 'wait', 'delay'],
  competitor: ['competitor', 'other', 'option', 'else', 'looking', 'comparing', 'using'],
};

function detectObjectionWords(text, objectionType) {
  if (!objectionType || !text) return new Set();
  const keywords = OBJECTION_KEYWORDS[objectionType] || [];
  const words = text.toLowerCase().split(/\s+/);
  const flagged = new Set();
  words.forEach((w, i) => {
    const clean = w.replace(/[^a-z]/g, '');
    if (keywords.some(k => clean.includes(k))) flagged.add(i);
  });
  return flagged;
}

export function LiveCaptions({ tokens, finalText, objectionType, status }) {
  const scrollRef  = useRef(null);
  const [visible, setVisible] = useState(false);
  const objMeta    = objectionType ? OBJECTION_META[objectionType] : null;
  const isEmpty    = tokens.length === 0 && !finalText;

  // Fade in on first token
  useEffect(() => {
    if (tokens.length > 0 || finalText) setVisible(true);
  }, [tokens.length, finalText]);

  // Auto-scroll captions
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [tokens]);

  if (status === 'idle' && isEmpty) return null;

  // Build word-level highlight map for final text
  const finalWords  = finalText ? finalText.split(' ') : [];
  const flaggedIdxs = finalText ? detectObjectionWords(finalText, objectionType) : new Set();

  return (
    <div
      className="w-full rounded-xl border overflow-hidden transition-all duration-500"
      style={{
        background: 'rgba(8,8,16,0.9)',
        backdropFilter: 'blur(12px)',
        borderColor: objMeta ? `${objMeta.color}35` : 'rgba(30,30,53,0.8)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(6px)',
        boxShadow: objMeta ? `0 0 20px ${objMeta.color}0a` : 'none',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: `1px solid rgba(30,30,53,0.8)`, background: 'rgba(0,0,0,0.2)' }}
      >
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
            status === 'listening'  ? 'bg-ghost-accent animate-pulse' :
            status === 'processing' ? 'bg-ghost-cyan animate-pulse'   :
            status === 'speaking'   ? 'bg-ghost-green'                 : 'bg-ghost-dim'
          }`} />
          <span className="font-mono text-xs text-ghost-dim uppercase tracking-wider">
            {status === 'listening'  ? 'Capturing prospect…' :
             status === 'processing' ? 'Transcribing…'       :
             status === 'speaking'   ? 'Prospect said'        : 'Caption'}
          </span>
        </div>

        {objMeta && (
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full" style={{ background: objMeta.color }} />
            <span
              className="font-mono text-xs px-2 py-0.5 rounded"
              style={{ background: `${objMeta.color}18`, color: objMeta.color }}
            >
              {objMeta.label} Objection Detected
            </span>
          </div>
        )}
      </div>

      {/* Caption body */}
      <div ref={scrollRef} className="px-4 py-3 min-h-[44px] max-h-28 overflow-y-auto">

        {/* Listening — no tokens yet */}
        {status === 'listening' && tokens.length === 0 && (
          <div className="flex items-center gap-2">
            <span className="text-ghost-dim text-sm font-mono italic">Listening</span>
            <span className="flex gap-0.5">
              {[0,1,2].map(i => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full bg-ghost-accent"
                  style={{ animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }}
                />
              ))}
            </span>
          </div>
        )}

        {/* Streaming token display */}
        {tokens.length > 0 && status === 'listening' && (
          <p className="text-ghost-text text-sm leading-relaxed font-body">
            {tokens.map((token, i) => (
              <span
                key={i}
                className="transition-colors duration-200"
                style={{
                  color: token.isObjection && objMeta ? objMeta.color : 'inherit',
                  textShadow: token.isObjection && objMeta ? `0 0 12px ${objMeta.color}60` : 'none',
                }}
              >
                {token.text}
              </span>
            ))}
            <span className="inline-block w-0.5 h-[1em] bg-ghost-accent animate-pulse ml-0.5 align-middle" />
          </p>
        )}

        {/* Final text with word-level objection highlight */}
        {finalText && status !== 'listening' && (
          <p className="text-sm leading-relaxed font-body">
            {finalWords.map((word, i) => {
              const isHighlighted = flaggedIdxs.has(i) && objMeta;
              return (
                <span
                  key={i}
                  className="transition-all duration-300"
                  style={{
                    color: isHighlighted ? objMeta.color : 'rgba(232,232,240,0.75)',
                    textShadow: isHighlighted ? `0 0 16px ${objMeta.color}70` : 'none',
                    fontWeight: isHighlighted ? '600' : 'normal',
                  }}
                >
                  {word}{i < finalWords.length - 1 ? ' ' : ''}
                </span>
              );
            })}
          </p>
        )}
      </div>
    </div>
  );
}
