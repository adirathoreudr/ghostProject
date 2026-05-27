import { useState, useRef, useCallback, useEffect } from 'react';

const RECORD_DURATION = 30; // seconds

export function useAudioRecorder() {
  const [state, setState] = useState('idle'); // idle | requesting | ready | recording | done | error
  const [secondsLeft, setSecondsLeft] = useState(RECORD_DURATION);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [volume, setVolume] = useState(0); // 0–100 for waveform

  const mediaRecorder = useRef(null);
  const stream = useRef(null);
  const chunks = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    if (stream.current) {
      stream.current.getTracks().forEach(t => t.stop());
      stream.current = null;
    }
    mediaRecorder.current = null;
    analyserRef.current = null;
  };

  const requestPermission = useCallback(async () => {
    setState('requesting');
    setErrorMsg(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      stream.current = s;
      setState('ready');
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Microphone access denied. Please allow mic access and reload.'
        : `Mic error: ${err.message}`;
      setErrorMsg(msg);
      setState('error');
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!stream.current || state !== 'ready') return;

    chunks.current = [];
    setAudioBlob(null);
    setAudioUrl(null);
    setSecondsLeft(RECORD_DURATION);

    // Setup analyser for volume visualization
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream.current);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const updateVolume = () => {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setVolume(Math.min(100, Math.round(avg * 2)));
      animFrameRef.current = requestAnimationFrame(updateVolume);
    };
    updateVolume();

    // Determine best supported MIME type
    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(stream.current, { mimeType });
    mediaRecorder.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setAudioBlob(blob);
      setAudioUrl(url);
      setState('done');
      setVolume(0);
      cancelAnimationFrame(animFrameRef.current);
    };

    recorder.start(250); // 250ms chunks for smooth data
    setState('recording');

    // Countdown timer
    let remaining = RECORD_DURATION;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        stopRecording();
      }
    }, 1000);
  }, [state]);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    setAudioBlob(null);
    setAudioUrl(null);
    setErrorMsg(null);
    setSecondsLeft(RECORD_DURATION);
    setVolume(0);
    setState('idle');
  }, []);

  return {
    state,
    secondsLeft,
    audioBlob,
    audioUrl,
    errorMsg,
    volume,
    totalDuration: RECORD_DURATION,
    requestPermission,
    startRecording,
    stopRecording,
    reset,
  };
}

function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}
