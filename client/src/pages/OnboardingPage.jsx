import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Square, ChevronRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { GhostLogo } from '../components/GhostLogo.jsx';
import { WaveformVisualizer } from '../components/WaveformVisualizer.jsx';
import { PersonaSelector } from '../components/PersonaSelector.jsx';
import { useAudioRecorder } from '../hooks/useAudioRecorder.js';
import { useProfileStore } from '../stores/profileStore.js';
import { api } from '../lib/api.js';

const STEPS = {
  NAME:       0,
  PERMISSION: 1,
  RECORD:     2,
  PERSONA:    3,
  UPLOADING:  4,
  DONE:       5,
};

const SCRIPT = "I help people solve problems and I close deals. My voice is clear, confident, and direct. I am ready to close.";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { addProfile, canAddProfile } = useProfileStore();

  const [step, setStep] = useState(STEPS.NAME);
  const [name, setName] = useState('');
  const [persona, setPersona] = useState('hormozi');
  const [uploadError, setUploadError] = useState(null);
  const [createdProfile, setCreatedProfile] = useState(null);

  const recorder = useAudioRecorder();

  // ── Step handlers ─────────────────────────────────────────────

  const handleNameSubmit = () => {
    if (!name.trim()) return;
    if (!canAddProfile()) {
      setUploadError('Maximum 3 profiles reached. Delete one first.');
      return;
    }
    setStep(STEPS.PERMISSION);
  };

  const handleRequestPermission = async () => {
    await recorder.requestPermission();
    if (recorder.state !== 'error') {
      setStep(STEPS.RECORD);
    }
  };

  // Permission request is async — watch state change
  React.useEffect(() => {
    if (step === STEPS.PERMISSION && recorder.state === 'ready') {
      setStep(STEPS.RECORD);
    }
    if (step === STEPS.PERMISSION && recorder.state === 'error') {
      // Stay on permission step, error shown
    }
  }, [recorder.state, step]);

  const handleStopAndContinue = () => {
    recorder.stopRecording();
    setStep(STEPS.PERSONA);
  };

  const handleSubmit = async () => {
    if (!recorder.audioBlob) return;
    setStep(STEPS.UPLOADING);
    setUploadError(null);

    try {
      const result = await api.voice.clone(recorder.audioBlob, name.trim());
      const profile = addProfile({
        name: name.trim(),
        voice_id: result.voice_id,
        persona,
      });
      setCreatedProfile(profile);
      setStep(STEPS.DONE);
    } catch (err) {
      setUploadError(err.message || 'Voice clone failed. Check your ElevenLabs API key and try again.');
      setStep(STEPS.PERSONA);
    }
  };

  const progress = ((step / 5) * 100).toFixed(0);

  return (
    <div className="min-h-screen bg-ghost-black flex flex-col items-center justify-center px-4 py-12">

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-ghost-border z-50">
        <div
          className="h-full bg-gradient-to-r from-ghost-accent to-ghost-gold transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="w-full max-w-lg animate-slide-up">

        {/* Logo */}
        <div className="mb-10 text-center">
          <GhostLogo size="lg" showTagline={step === STEPS.NAME} />
        </div>

        {/* ── STEP 0: Name ─────────────────────────────────────── */}
        {step === STEPS.NAME && (
          <div className="animate-slide-up">
            <h1 className="font-display text-3xl font-bold text-ghost-text mb-2">
              Who is this profile for?
            </h1>
            <p className="text-ghost-sub mb-8 leading-relaxed">
              Ghost will clone your voice and respond in it on live calls.
              You can add up to 3 profiles per workspace.
            </p>

            <div className="mb-6">
              <label className="block text-ghost-sub text-sm font-mono uppercase tracking-widest mb-2">
                Your Name
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                placeholder="e.g. Alex, Sarah, Dev Team"
                className="w-full bg-ghost-surface border border-ghost-border rounded-xl px-4 py-3.5 text-ghost-text font-body text-base placeholder-ghost-dim focus:outline-none focus:border-ghost-accent transition-colors"
              />
            </div>

            {uploadError && <ErrorBanner msg={uploadError} />}

            <button
              onClick={handleNameSubmit}
              disabled={!name.trim()}
              className="btn-ghost w-full py-4 rounded-xl flex items-center justify-center gap-2 font-display text-base"
            >
              Continue <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ── STEP 1: Mic Permission ───────────────────────────── */}
        {step === STEPS.PERMISSION && (
          <div className="animate-slide-up text-center">
            <div className="w-20 h-20 rounded-2xl bg-ghost-card border border-ghost-border flex items-center justify-center mx-auto mb-6">
              <Mic size={36} className="text-ghost-accent" />
            </div>
            <h1 className="font-display text-3xl font-bold text-ghost-text mb-3">
              Mic access needed
            </h1>
            <p className="text-ghost-sub mb-8 leading-relaxed max-w-sm mx-auto">
              Ghost needs your microphone to record a voice sample and clone it.
              This runs locally — nothing is stored without your action.
            </p>

            {recorder.state === 'error' && (
              <ErrorBanner msg={recorder.errorMsg} className="mb-6 text-left" />
            )}

            <button
              onClick={handleRequestPermission}
              disabled={recorder.state === 'requesting'}
              className="btn-ghost w-full py-4 rounded-xl flex items-center justify-center gap-2 font-display text-base"
            >
              {recorder.state === 'requesting' ? (
                <><Loader2 size={18} className="animate-spin" /> Requesting…</>
              ) : (
                <><Mic size={18} /> Allow Microphone</>
              )}
            </button>
          </div>
        )}

        {/* ── STEP 2: Record ───────────────────────────────────── */}
        {step === STEPS.RECORD && (
          <div className="animate-slide-up">
            <h1 className="font-display text-3xl font-bold text-ghost-text mb-2">
              Record your voice
            </h1>
            <p className="text-ghost-sub mb-2">
              Read the script below clearly and naturally. No need to perform.
              Ghost will clone your actual speaking voice.
            </p>

            {/* Script card */}
            <div className="glass rounded-2xl p-5 mb-6 border-l-2 border-ghost-accent">
              <p className="text-xs font-mono text-ghost-accent uppercase tracking-widest mb-3">
                Say this aloud:
              </p>
              <p className="text-ghost-text leading-relaxed font-body text-lg italic">
                "{SCRIPT}"
              </p>
            </div>

            {/* Waveform */}
            <div className="glass rounded-2xl p-6 mb-6 flex flex-col items-center">
              <WaveformVisualizer
                volume={recorder.volume}
                isActive={recorder.state === 'recording'}
                color="#e94560"
              />

              {/* Timer */}
              {recorder.state === 'recording' && (
                <div className="mt-4 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-ghost-accent animate-pulse" />
                  <span className="font-mono text-ghost-accent text-sm">
                    REC
                  </span>
                  <span className="font-mono text-ghost-text">
                    {String(Math.floor(recorder.secondsLeft / 60)).padStart(2,'0')}:
                    {String(recorder.secondsLeft % 60).padStart(2,'0')}
                  </span>

                  {/* Progress arc */}
                  <div className="ml-2">
                    <svg width="32" height="32" viewBox="0 0 32 32">
                      <circle cx="16" cy="16" r="12" fill="none" stroke="#1e1e35" strokeWidth="2.5" />
                      <circle
                        cx="16" cy="16" r="12"
                        fill="none" stroke="#e94560" strokeWidth="2.5"
                        strokeDasharray={`${2 * Math.PI * 12}`}
                        strokeDashoffset={`${2 * Math.PI * 12 * (recorder.secondsLeft / recorder.totalDuration)}`}
                        strokeLinecap="round"
                        transform="rotate(-90 16 16)"
                        style={{ transition: 'stroke-dashoffset 1s linear' }}
                      />
                    </svg>
                  </div>
                </div>
              )}

              {recorder.state === 'ready' && (
                <p className="mt-3 text-ghost-dim text-sm font-mono">Ready to record</p>
              )}

              {recorder.state === 'done' && (
                <div className="mt-3 flex items-center gap-2 text-ghost-green">
                  <CheckCircle2 size={16} />
                  <span className="font-mono text-sm">Recording complete</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-3">
              {recorder.state === 'ready' && (
                <button
                  onClick={recorder.startRecording}
                  className="btn-ghost flex-1 py-4 rounded-xl flex items-center justify-center gap-2 font-display text-base"
                >
                  <Mic size={18} /> Start Recording
                </button>
              )}

              {recorder.state === 'recording' && (
                <>
                  <button
                    onClick={handleStopAndContinue}
                    className="btn-ghost flex-1 py-4 rounded-xl flex items-center justify-center gap-2 font-display text-base"
                  >
                    <Square size={16} fill="white" /> Stop & Continue
                  </button>
                </>
              )}

              {recorder.state === 'done' && (
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => { recorder.reset(); setTimeout(() => recorder.requestPermission(), 100); }}
                    className="py-4 px-5 rounded-xl border border-ghost-border text-ghost-sub hover:text-ghost-text hover:border-ghost-muted transition-all font-mono text-sm"
                  >
                    Re-record
                  </button>
                  <button
                    onClick={() => setStep(STEPS.PERSONA)}
                    className="btn-ghost flex-1 py-4 rounded-xl flex items-center justify-center gap-2 font-display text-base"
                  >
                    Continue <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>

            {/* Playback if done */}
            {recorder.audioUrl && recorder.state === 'done' && (
              <div className="mt-4">
                <p className="text-ghost-dim text-xs font-mono mb-2">Preview your recording:</p>
                <audio controls src={recorder.audioUrl} className="w-full h-8 opacity-60" />
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Persona ──────────────────────────────────── */}
        {step === STEPS.PERSONA && (
          <div className="animate-slide-up">
            <h1 className="font-display text-3xl font-bold text-ghost-text mb-2">
              Choose your coach
            </h1>
            <p className="text-ghost-sub mb-6">
              Ghost will respond in your voice but with this coach's style and frameworks.
              You can change this anytime.
            </p>

            <PersonaSelector selected={persona} onSelect={setPersona} />

            {uploadError && <ErrorBanner msg={uploadError} className="mt-4" />}

            <button
              onClick={handleSubmit}
              className="btn-ghost w-full mt-6 py-4 rounded-xl flex items-center justify-center gap-2 font-display text-base"
            >
              Clone My Voice <ChevronRight size={18} />
            </button>

            <p className="text-ghost-dim text-xs text-center mt-3 font-mono">
              Your audio is sent to ElevenLabs and deleted from our server immediately.
            </p>
          </div>
        )}

        {/* ── STEP 4: Uploading ────────────────────────────────── */}
        {step === STEPS.UPLOADING && (
          <div className="animate-slide-up text-center">
            <div className="w-20 h-20 rounded-2xl bg-ghost-card border border-ghost-accent flex items-center justify-center mx-auto mb-6"
              style={{ boxShadow: '0 0 40px rgba(233,69,96,0.3)' }}>
              <Loader2 size={36} className="text-ghost-accent animate-spin" />
            </div>
            <h1 className="font-display text-3xl font-bold text-ghost-text mb-3">
              Cloning your voice…
            </h1>
            <p className="text-ghost-sub leading-relaxed">
              ElevenLabs is building your voice model.
              This takes about 10–20 seconds.
            </p>
            <div className="mt-8 flex justify-center gap-1.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-ghost-accent"
                  style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 5: Done ─────────────────────────────────────── */}
        {step === STEPS.DONE && createdProfile && (
          <div className="animate-slide-up text-center">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', boxShadow: '0 0 40px rgba(0,255,136,0.2)' }}
            >
              <CheckCircle2 size={36} className="text-ghost-green" />
            </div>
            <h1 className="font-display text-3xl font-bold text-ghost-text mb-3">
              Ghost is ready.
            </h1>
            <p className="text-ghost-sub mb-2 leading-relaxed">
              Voice clone created for <span className="text-ghost-text font-semibold">{createdProfile.name}</span>.
            </p>
            <p className="font-mono text-ghost-dim text-xs mb-8">
              voice_id: {createdProfile.voice_id}
            </p>

            <button
              onClick={() => navigate('/')}
              className="btn-ghost w-full py-4 rounded-xl flex items-center justify-center gap-2 font-display text-base"
            >
              Go to Dashboard <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Step indicator dots */}
        <div className="flex justify-center gap-2 mt-10">
          {Object.values(STEPS).slice(0, 5).map((s) => (
            <div
              key={s}
              className={`h-1 rounded-full transition-all duration-300 ${
                step === s ? 'w-6 bg-ghost-accent' :
                step > s  ? 'w-2 bg-ghost-green' :
                             'w-2 bg-ghost-border'
              }`}
            />
          ))}
        </div>

      </div>
    </div>
  );
}

function ErrorBanner({ msg, className = '' }) {
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl bg-red-950/40 border border-red-800/50 ${className}`}>
      <AlertCircle size={16} className="text-ghost-accent mt-0.5 shrink-0" />
      <p className="text-red-300 text-sm leading-relaxed">{msg}</p>
    </div>
  );
}
