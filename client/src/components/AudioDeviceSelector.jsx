import React, { useState, useEffect } from 'react';
import { Volume2, ChevronDown, Check } from 'lucide-react';

/**
 * AudioDeviceSelector
 * Lets the user pick which audio OUTPUT device Ghost speaks through.
 * On M2 Mac with BlackHole installed, "BlackHole 2ch" will appear here.
 * Setting it routes Ghost's TTS directly into any call app using BlackHole as input.
 */
export function AudioDeviceSelector({ onDeviceSelect }) {
  const [devices, setDevices] = useState([]);
  const [selectedId, setSelectedId] = useState(window.__ghostAudioSinkId || 'default');
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // setSinkId requires HTTPS or localhost + user gesture
    setSupported(typeof HTMLMediaElement.prototype.setSinkId === 'function');

    async function loadDevices() {
      try {
        // Must request mic first so device labels are populated
        await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
        const all = await navigator.mediaDevices.enumerateDevices();
        const outputs = all.filter(d => d.kind === 'audiooutput');
        setDevices(outputs);
      } catch (err) {
        console.warn('[AudioDevice] Could not enumerate devices:', err.message);
      }
    }

    loadDevices();

    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
  }, []);

  const handleSelect = (deviceId) => {
    setSelectedId(deviceId);
    window.__ghostAudioSinkId = deviceId === 'default' ? null : deviceId;
    onDeviceSelect?.(deviceId);
    setOpen(false);
    console.log('[AudioDevice] Output set to:', deviceId);
  };

  const selectedDevice = devices.find(d => d.deviceId === selectedId);
  const displayName = selectedId === 'default' ? 'Default Speaker' : (selectedDevice?.label || selectedId.slice(0, 20));

  if (!supported) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ghost-surface border border-ghost-border">
        <Volume2 size={14} className="text-ghost-dim" />
        <div>
          <p className="text-ghost-dim text-xs font-mono">Audio output selection</p>
          <p className="text-ghost-dim text-xs">Not supported in this browser — use Chrome</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-ghost-surface border border-ghost-border hover:border-ghost-muted transition-all"
      >
        <div className="flex items-center gap-2">
          <Volume2 size={14} className="text-ghost-sub" />
          <div className="text-left">
            <p className="text-ghost-dim text-xs font-mono uppercase tracking-wider">Ghost Output Device</p>
            <p className="text-ghost-text text-sm font-mono truncate max-w-48">{displayName}</p>
          </div>
        </div>
        <ChevronDown size={14} className={`text-ghost-dim transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 right-0 rounded-xl border border-ghost-border bg-ghost-card shadow-2xl z-10 overflow-hidden">
          <div className="p-2 space-y-0.5">
            <DeviceOption
              label="Default Speaker"
              deviceId="default"
              selected={selectedId === 'default'}
              onSelect={handleSelect}
            />
            {devices.map(d => (
              <DeviceOption
                key={d.deviceId}
                label={d.label || `Output ${d.deviceId.slice(0, 8)}`}
                deviceId={d.deviceId}
                selected={selectedId === d.deviceId}
                isBlackHole={d.label?.toLowerCase().includes('blackhole')}
                onSelect={handleSelect}
              />
            ))}
          </div>
          <div className="px-3 py-2 border-t border-ghost-border bg-ghost-surface">
            <p className="text-ghost-dim text-xs font-mono">
              M2 Mac: Select "BlackHole 2ch" to route Ghost into your call
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function DeviceOption({ label, deviceId, selected, isBlackHole, onSelect }) {
  return (
    <button
      onClick={() => onSelect(deviceId)}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all ${
        selected ? 'bg-ghost-surface border border-ghost-border' : 'hover:bg-ghost-surface'
      }`}
    >
      <div className="flex items-center gap-2">
        {isBlackHole && (
          <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-ghost-green/10 text-ghost-green border border-ghost-green/30">
            BH
          </span>
        )}
        <span className={`text-sm font-mono truncate ${selected ? 'text-ghost-text' : 'text-ghost-sub'}`}>
          {label}
        </span>
      </div>
      {selected && <Check size={12} className="text-ghost-green shrink-0" />}
    </button>
  );
}
