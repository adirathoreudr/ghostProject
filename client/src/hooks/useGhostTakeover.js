import { useEffect, useRef, useCallback } from 'react';
import { useGhostStore } from '../stores/ghostStore.js';

const MIME_PREFERENCE = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

function getBestMime() {
  for (const m of MIME_PREFERENCE) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

export function useGhostTakeover(activeProfile) {
  const store = useGhostStore();

  const streamRef     = useRef(null);
  const recorderRef   = useRef(null);
  const chunksRef     = useRef([]);
  const spaceHeld     = useRef(false);
  const processingRef = useRef(false);
  const audioRef      = useRef(null);
  const abortRef      = useRef(null);
  const mimeRef       = useRef('');
  const recordStartMs = useRef(0);

  const initMic = useCallback(async () => {
    if (streamRef.current) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 44100 },
      });
      streamRef.current = s;
      mimeRef.current = getBestMime();
      console.log('[Ghost] Mic ready | MIME:', mimeRef.current);
    } catch (err) {
      console.error('[Ghost] Mic init failed:', err.message);
      store.setError(`Mic access denied: ${err.message}`);
    }
  }, []);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }, []);

  const cancelInFlight = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const handleSpaceDown = useCallback(async () => {
    if (spaceHeld.current) return;
    if (processingRef.current) return;
    if (!activeProfile?.voice_id) {
      store.setError('No active profile. Complete onboarding first.');
      return;
    }

    spaceHeld.current = true;
    stopPlayback();
    cancelInFlight();
    store.setListening();

    if (!streamRef.current) {
      await initMic();
      if (!streamRef.current) return;
    }

    chunksRef.current = [];
    try {
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType: mimeRef.current,
        audioBitsPerSecond: 128000,
      });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(200);
      recordStartMs.current = Date.now();
      console.log('[Ghost] 🎙️  Recording started');
    } catch (err) {
      console.error('[Ghost] MediaRecorder failed:', err.message);
      store.setError(`Recording failed: ${err.message}`);
      spaceHeld.current = false;
    }
  }, [activeProfile, initMic, stopPlayback, cancelInFlight]);

  const handleSpaceUp = useCallback(async () => {
    if (!spaceHeld.current) return;
    spaceHeld.current = false;

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') { store.setIdle(); return; }

    await new Promise((resolve) => { recorder.onstop = resolve; recorder.stop(); });
    recorderRef.current = null;

    const audioBlob = new Blob(chunksRef.current, { type: mimeRef.current || 'audio/webm' });
    chunksRef.current = [];

    if (audioBlob.size < 1000) {
      console.warn('[Ghost] Audio too short:', audioBlob.size, 'bytes');
      store.setError('Recording too short. Hold SPACE while speaking the objection.');
      return;
    }

    // Enforce minimum 700ms recording time — ElevenLabs STT rejects very short clips
    const heldMs = Date.now() - recordStartMs.current;
    if (heldMs < 700) {
      const wait = 700 - heldMs;
      console.warn(`[Ghost] Recording only ${heldMs}ms — waiting ${wait}ms more before submit`);
      await new Promise(r => setTimeout(r, wait));
    }

    console.log(`[Ghost] Audio captured: ${audioBlob.size} bytes | starting pipeline`);
    store.setProcessing();
    processingRef.current = true;

    try {
      await runPipeline(audioBlob, activeProfile, store, abortRef, audioRef);
    } finally {
      processingRef.current = false;
    }
  }, [activeProfile]);

  useEffect(() => {
    const onDown = (e) => {
      if (e.code === 'Space' && !e.repeat && !isTypingTarget(e.target)) {
        e.preventDefault();
        handleSpaceDown();
      }
      if (e.code === 'Escape') {
        cancelInFlight();
        stopPlayback();
        spaceHeld.current = false;
        processingRef.current = false;
        if (recorderRef.current?.state !== 'inactive') { recorderRef.current?.stop(); recorderRef.current = null; }
        store.setIdle();
      }
    };
    const onUp = (e) => {
      if (e.code === 'Space' && !isTypingTarget(e.target)) { e.preventDefault(); handleSpaceUp(); }
    };
    window.addEventListener('keydown', onDown, { capture: true });
    window.addEventListener('keyup', onUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', onDown, { capture: true });
      window.removeEventListener('keyup', onUp, { capture: true });
    };
  }, [handleSpaceDown, handleSpaceUp, cancelInFlight, stopPlayback]);

  useEffect(() => {
    if (activeProfile?.voice_id) initMic();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  }, [activeProfile?.id]);

  useEffect(() => {
    return () => { cancelInFlight(); stopPlayback(); };
  }, []);

  return {
    status: store.status,
    transcript: store.transcript,
    objectionType: store.objectionType,
    confidence: store.confidence,
    responseText: store.responseText,
    errorMsg: store.errorMsg,
    latencyMs: store.latencyMs,
    sessionLog: store.sessionLog,
    captionTokens: store.captionTokens,
    captionFinal: store.captionFinal,
    clearSession: store.clearSession,
    setIdle: store.setIdle,
    audioRef,
  };
}

// ── Pipeline ───────────────────────────────────────────────────────────────

async function runPipeline(audioBlob, activeProfile, store, abortRef, audioRef) {
  const { voice_id, persona, name } = activeProfile;
  const pipelineStart = performance.now();
  const conversationId = store.conversationId || crypto.randomUUID();

  const form = new FormData();
  form.append('audio', audioBlob, 'objection.webm');
  form.append('voice_id', voice_id);
  form.append('persona', persona || 'hormozi');
  form.append('profile_name', name || 'Ghost Rep');
  form.append('mime_type', audioBlob.type);
  form.append('conversation_id', conversationId);

  abortRef.current = new AbortController();

  let response;
  try {
    response = await fetch('/api/ghost/takeover', {
      method: 'POST',
      body: form,
      signal: abortRef.current.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') { store.setIdle(); return; }
    store.setError(`Network error: ${err.message}`);
    return;
  }

  if (!response.ok) {
    let errData = {};
    try { errData = await response.json(); } catch {}
    const msg = errData.error || `Server error ${response.status}`;
    const step = errData.step || 'unknown';
    console.error(`[Ghost] Pipeline failed at [${step}]:`, msg);
    store.setError(`${step.toUpperCase()} failed: ${msg}`);
    return;
  }

  const transcript    = safeDecodeHeader(response.headers.get('x-ghost-transcript'));
  const objectionType = response.headers.get('x-ghost-objection-type') || 'stall';
  const confidence    = parseFloat(response.headers.get('x-ghost-confidence') || '0.8');
  const responseText  = safeDecodeHeader(response.headers.get('x-ghost-response-text'));
  const classifyMs    = parseInt(response.headers.get('x-ghost-classify-ms') || '0');

  // Simulate caption token streaming for visual effect
  if (transcript) {
    const words = transcript.split(' ');
    words.forEach((word, i) => {
      setTimeout(() => store.addCaptionToken(word + ' ', false), i * 60);
    });
  }

  // Always use the live TTS audio from the server — prewarm cache is not used
  // for playback because the LLM generates dynamic responses each time.
  const audioArrayBuffer = await response.arrayBuffer();
  const audioBlob2 = new Blob([audioArrayBuffer], { type: 'audio/mpeg' });
  const audioUrl = URL.createObjectURL(audioBlob2);

  const totalMs = Math.round(performance.now() - pipelineStart);
  store.setSpeaking({ transcript, objectionType, confidence, responseText, latencyMs: totalMs });

  const audio = new Audio(audioUrl);
  audioRef.current = audio;

  if (audio.setSinkId && window.__ghostAudioSinkId) {
    try {
      await audio.setSinkId(window.__ghostAudioSinkId);
      console.log('[Ghost] 🔊 Output routed to:', window.__ghostAudioSinkId);
    } catch (e) {
      console.warn('[Ghost] setSinkId failed, falling back to default:', e.message);
    }
  }

  audio.onended = () => { audioRef.current = null; URL.revokeObjectURL(audioUrl); store.setIdle(); };
  audio.onerror = () => { audioRef.current = null; URL.revokeObjectURL(audioUrl); store.setError('Audio playback failed.'); };

  console.log(`[Ghost] 🔊 Playing (${totalMs}ms total)`);
  try {
    await audio.play();
  } catch (playErr) {
    URL.revokeObjectURL(audioUrl);
    store.setError(`Playback blocked: ${playErr.message}. Click anywhere first.`);
  }
}

function safeDecodeHeader(val) {
  if (!val) return '';
  try { return decodeURIComponent(val); } catch { return val; }
}

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || el.isContentEditable;
}
