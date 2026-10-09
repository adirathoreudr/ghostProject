// Minimal helpers for 16-bit PCM WAV — the format the free voice path uses
// for both NVIDIA Riva (raw PCM in/out) and the local Chatterbox server.

/**
 * Parse a 16-bit PCM WAV buffer.
 * @returns {{ sampleRate: number, channels: number, pcm: Buffer }}
 */
export function parseWav(buf) {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a WAV file');
  }
  let fmt = null;
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmt = {
        format: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bitsPerSample: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      if (!fmt) throw new Error('WAV data chunk appears before the fmt chunk');
      if (fmt.format !== 1 || fmt.bitsPerSample !== 16) throw new Error('Only 16-bit PCM WAV is supported');
      // Streaming writers sometimes leave the size as 0xFFFFFFFF — clamp to what we have.
      return { sampleRate: fmt.sampleRate, channels: fmt.channels, pcm: buf.subarray(body, Math.min(body + size, buf.length)) };
    }
    offset = body + size + (size % 2);
  }
  throw new Error('WAV file has no data chunk');
}

/** Wrap raw 16-bit little-endian PCM in a WAV header. */
export function pcmToWav(pcm, sampleRate, channels = 1) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);                        // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28); // byte rate
  header.writeUInt16LE(channels * 2, 32);              // block align
  header.writeUInt16LE(16, 34);                        // bits per sample
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
