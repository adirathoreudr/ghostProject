/**
 * Convert a MediaRecorder blob (webm/ogg/mp4) to a mono 16-bit PCM WAV at
 * `sampleRate`. Free mode needs WAV (NVIDIA Riva and the local voice server
 * take raw PCM); ElevenLabs accepts it too. Falls back to the original blob
 * if the browser can't decode the recording.
 */
export async function toWav(blob, sampleRate = 16000) {
  try {
    const ctx = new AudioContext();
    let decoded;
    try {
      decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    } finally {
      ctx.close();
    }
    const frames = Math.max(1, Math.ceil(decoded.duration * sampleRate));
    const offline = new OfflineAudioContext(1, frames, sampleRate); // 1 channel → automatic downmix
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return new Blob([encodeWav(rendered.getChannelData(0), sampleRate)], { type: 'audio/wav' });
  } catch (err) {
    console.warn('[Audio] WAV conversion failed, sending the original recording:', err.message);
    return blob;
  }
}

/** Encode mono float samples (-1…1) as a 16-bit PCM WAV file. */
export function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, s) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);              // PCM
  view.setUint16(22, 1, true);              // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);              // block align
  view.setUint16(34, 16, true);             // bits per sample
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/** File extension for an upload, from the blob's MIME type. */
export function audioExtension(type = '') {
  const base = type.split(';')[0];
  return { 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3' }[base] || 'webm';
}
