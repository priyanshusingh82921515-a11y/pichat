import type { VoiceEffectId } from './constants';

// =============================================================================
// INLINE LOW-LATENCY AUDIOWORKLET GRANULAR PITCH SHIFTER (LIVE CALLS)
// Dual-tap Hanning-windowed delay-line pitch shifter running on audio thread.
// =============================================================================

const PITCH_WORKLET_CODE = `
class QuadlinePitchProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'pitchRatio', defaultValue: 1.0, minValue: 0.5, maxValue: 2.0, automationRate: 'k-rate' }
    ];
  }

  constructor() {
    super();
    this.bufSize = 4096;
    this.buffer = new Float32Array(this.bufSize);
    this.writeIndex = 0;
    this.phase = 0;
    this.windowSize = 1536; // ~32ms at 48kHz — low latency & smooth formant preservation
  }

  readSample(delaySamples) {
    let pos = this.writeIndex - delaySamples;
    while (pos < 0) pos += this.bufSize;
    while (pos >= this.bufSize) pos -= this.bufSize;
    const idx0 = Math.floor(pos);
    const idx1 = (idx0 + 1) % this.bufSize;
    const frac = pos - idx0;
    return this.buffer[idx0] * (1 - frac) + this.buffer[idx1] * frac;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;

    const inCh = input[0];
    const outCh = output[0];
    const ratio = parameters.pitchRatio[0];

    if (Math.abs(ratio - 1.0) < 0.005) {
      for (let i = 0; i < inCh.length; i++) {
        this.buffer[this.writeIndex] = inCh[i];
        this.writeIndex = (this.writeIndex + 1) % this.bufSize;
        outCh[i] = inCh[i];
      }
      return true;
    }

    const phaseStep = (1.0 - ratio) / this.windowSize;
    for (let i = 0; i < inCh.length; i++) {
      this.buffer[this.writeIndex] = inCh[i];

      let p1 = this.phase;
      let p2 = p1 + 0.5;
      if (p2 >= 1.0) p2 -= 1.0;

      const d1 = p1 * this.windowSize + 16;
      const d2 = p2 * this.windowSize + 16;

      // Cosine/Hanning crossfade window
      const g1 = 0.5 - 0.5 * Math.cos(2 * Math.PI * p1);
      const g2 = 0.5 - 0.5 * Math.cos(2 * Math.PI * p2);

      outCh[i] = this.readSample(d1) * g1 + this.readSample(d2) * g2;

      this.phase += phaseStep;
      if (this.phase >= 1.0) this.phase -= 1.0;
      if (this.phase < 0.0) this.phase += 1.0;

      this.writeIndex = (this.writeIndex + 1) % this.bufSize;
    }

    // Mirror mono output to any additional output channels
    for (let ch = 1; ch < output.length; ch++) {
      output[ch].set(outCh);
    }
    return true;
  }
}
registerProcessor('quadline-pitch-processor', QuadlinePitchProcessor);
`;

function getEffectPitchRatio(effect: VoiceEffectId): number {
  switch (effect) {
    case 'deep':
      return 0.76;
    case 'high_pitch':
      return 1.48;
    case 'child':
      return 1.28;
    case 'old_man':
      return 0.84;
    case 'alien':
      return 1.18;
    default:
      return 1.0;
  }
}

function makeSoftClipCurve(amount: number): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

// Builds modular DSP chain between `inputNode` and `outputNode` on any BaseAudioContext
function wireEffectSubgraph(
  ctx: BaseAudioContext,
  effect: VoiceEffectId,
  inputNode: AudioNode,
  outputNode: AudioNode,
  oscillatorsToStop: OscillatorNode[]
) {
  if (effect === 'normal') {
    inputNode.connect(outputNode);
    return;
  }

  if (effect === 'deep') {
    const lowShelf = ctx.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 180;
    lowShelf.gain.value = 6.5;

    const lowPass = ctx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 2800;

    const gain = ctx.createGain();
    gain.gain.value = 1.15;

    inputNode.connect(lowShelf);
    lowShelf.connect(lowPass);
    lowPass.connect(gain);
    gain.connect(outputNode);
    return;
  }

  if (effect === 'high_pitch') {
    const highPass = ctx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 220;

    const highShelf = ctx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 2100;
    highShelf.gain.value = 4.5;

    inputNode.connect(highPass);
    highPass.connect(highShelf);
    highShelf.connect(outputNode);
    return;
  }

  if (effect === 'child') {
    const highPass = ctx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 180;

    const formant = ctx.createBiquadFilter();
    formant.type = 'peaking';
    formant.frequency.value = 2500;
    formant.Q.value = 1.1;
    formant.gain.value = 5.5;

    inputNode.connect(highPass);
    highPass.connect(formant);
    formant.connect(outputNode);
    return;
  }

  if (effect === 'robot') {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1150;
    band.Q.value = 1.2;

    const ringGain = ctx.createGain();
    ringGain.gain.value = 0;

    const carrier = ctx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.value = 52;
    carrier.connect(ringGain.gain);
    carrier.start();
    oscillatorsToStop.push(carrier);

    const combDelay = ctx.createDelay(0.1);
    combDelay.delayTime.value = 0.014;
    const combFeedback = ctx.createGain();
    combFeedback.gain.value = 0.42;

    const dry = ctx.createGain();
    dry.gain.value = 0.35;
    const wet = ctx.createGain();
    wet.gain.value = 0.9;

    inputNode.connect(dry);
    dry.connect(outputNode);

    inputNode.connect(band);
    band.connect(ringGain);
    ringGain.connect(combDelay);
    combDelay.connect(combFeedback);
    combFeedback.connect(combDelay);
    ringGain.connect(wet);
    combDelay.connect(wet);
    wet.connect(outputNode);
    return;
  }

  if (effect === 'echo') {
    const dry = ctx.createGain();
    dry.gain.value = 1.0;

    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.24;

    const feedback = ctx.createGain();
    feedback.gain.value = 0.44;

    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2600;

    const wet = ctx.createGain();
    wet.gain.value = 0.58;

    inputNode.connect(dry);
    dry.connect(outputNode);

    inputNode.connect(delay);
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);
    damp.connect(wet);
    wet.connect(outputNode);
    return;
  }

  if (effect === 'old_man') {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 820;
    band.Q.value = 0.65;

    const shaper = ctx.createWaveShaper();
    shaper.curve = makeSoftClipCurve(18);
    shaper.oversample = '2x';

    const tremoloGain = ctx.createGain();
    tremoloGain.gain.value = 0.85;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 6.2;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.22;
    lfo.connect(lfoDepth);
    lfoDepth.connect(tremoloGain.gain);
    lfo.start();
    oscillatorsToStop.push(lfo);

    const outGain = ctx.createGain();
    outGain.gain.value = 1.3;

    inputNode.connect(band);
    band.connect(shaper);
    shaper.connect(tremoloGain);
    tremoloGain.connect(outGain);
    outGain.connect(outputNode);
    return;
  }

  if (effect === 'alien') {
    const ringGain = ctx.createGain();
    ringGain.gain.value = 0;

    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = 145;

    const freqLfo = ctx.createOscillator();
    freqLfo.type = 'sine';
    freqLfo.frequency.value = 9.5;
    const freqDepth = ctx.createGain();
    freqDepth.gain.value = 55;
    freqLfo.connect(freqDepth);
    freqDepth.connect(carrier.frequency);

    carrier.connect(ringGain.gain);
    carrier.start();
    freqLfo.start();
    oscillatorsToStop.push(carrier, freqLfo);

    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.068;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.5;

    const dry = ctx.createGain();
    dry.gain.value = 0.35;
    const wet = ctx.createGain();
    wet.gain.value = 0.95;

    inputNode.connect(dry);
    dry.connect(outputNode);

    inputNode.connect(ringGain);
    ringGain.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    ringGain.connect(wet);
    delay.connect(wet);
    wet.connect(outputNode);
  }
}

// =============================================================================
// LIVE CALL VOICE PROCESSOR (REAL-TIME SWITCHING FOR WEBRTC CALLS)
// =============================================================================

export interface LiveVoiceProcessor {
  outputStream: MediaStream;
  setEffect: (effect: VoiceEffectId) => void;
  getEffect: () => VoiceEffectId;
  setMonitorEnabled: (enabled: boolean) => void;
  resume: () => Promise<void>;
  dispose: () => void;
}

export async function createLiveVoiceProcessor(
  rawAudioStream: MediaStream,
  initialEffect: VoiceEffectId = 'normal'
): Promise<LiveVoiceProcessor> {
  const ctx = new AudioContext({ latencyHint: 'interactive' });
  let disposed = false;
  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => {});
  }
  ctx.onstatechange = () => {
    if (!disposed && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };

  const source = ctx.createMediaStreamSource(rawAudioStream);
  const destination = ctx.createMediaStreamDestination();

  let pitchNode: AudioWorkletNode | null = null;
  let workletUrl: string | null = null;
  try {
    if (ctx.audioWorklet) {
      const blob = new Blob([PITCH_WORKLET_CODE], { type: 'application/javascript' });
      workletUrl = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(workletUrl);
      pitchNode = new AudioWorkletNode(ctx, 'quadline-pitch-processor');
    }
  } catch {
    pitchNode = null;
  } finally {
    if (workletUrl) {
      URL.revokeObjectURL(workletUrl);
    }
  }

  const preEffectBus = ctx.createGain();
  const postEffectBus = ctx.createGain();
  const monitorGain = ctx.createGain();
  monitorGain.gain.value = 0;

  postEffectBus.connect(destination);
  postEffectBus.connect(monitorGain);
  monitorGain.connect(ctx.destination);

  if (pitchNode) {
    source.connect(pitchNode);
    pitchNode.connect(preEffectBus);
  } else {
    source.connect(preEffectBus);
  }

  let currentEffect: VoiceEffectId = initialEffect;
  let activeOscillators: OscillatorNode[] = [];

  const applyEffect = (effect: VoiceEffectId) => {
    currentEffect = effect;

    // Stop previous oscillators cleanly
    for (const osc of activeOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Ignore already-stopped oscillator
      }
    }
    activeOscillators = [];

    try {
      preEffectBus.disconnect();
    } catch {
      // Ignore if not connected yet
    }

    const ratio = getEffectPitchRatio(effect);
    if (pitchNode) {
      const param = pitchNode.parameters.get('pitchRatio');
      if (param) {
        param.setValueAtTime(ratio, ctx.currentTime);
      }
    }

    wireEffectSubgraph(ctx, effect, preEffectBus, postEffectBus, activeOscillators);
  };

  applyEffect(initialEffect);

  return {
    outputStream: destination.stream,
    setEffect: (effect: VoiceEffectId) => {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      applyEffect(effect);
    },
    getEffect: () => currentEffect,
    setMonitorEnabled: (enabled: boolean) => {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      monitorGain.gain.setTargetAtTime(enabled ? 0.85 : 0, ctx.currentTime, 0.02);
    },
    resume: async () => {
      if (!disposed && ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
    },
    dispose: () => {
      disposed = true;
      ctx.onstatechange = null;
      for (const osc of activeOscillators) {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // Ignore
        }
      }
      activeOscillators = [];
      try {
        source.disconnect();
        pitchNode?.disconnect();
        preEffectBus.disconnect();
        postEffectBus.disconnect();
        monitorGain.disconnect();
      } catch {
        // Ignore
      }
      ctx.close().catch(() => {});
    },
  };
}

// =============================================================================
// OFFLINE VOICE NOTE PROCESSOR (PREVIEW, SEND, WAV EXPORT & WAVEFORM)
// =============================================================================

function applyPitchShiftFloat32(input: Float32Array, ratio: number): Float32Array {
  if (Math.abs(ratio - 1.0) < 0.005) {
    return new Float32Array(input);
  }
  const bufSize = 4096;
  const ring = new Float32Array(bufSize);
  const output = new Float32Array(input.length);
  const windowSize = 1536;
  let writeIdx = 0;
  let phase = 0;
  const phaseStep = (1.0 - ratio) / windowSize;

  const readRing = (delay: number) => {
    let pos = writeIdx - delay;
    while (pos < 0) pos += bufSize;
    while (pos >= bufSize) pos -= bufSize;
    const i0 = Math.floor(pos);
    const i1 = (i0 + 1) % bufSize;
    const frac = pos - i0;
    return ring[i0] * (1 - frac) + ring[i1] * frac;
  };

  for (let i = 0; i < input.length; i++) {
    ring[writeIdx] = input[i];

    let p1 = phase;
    let p2 = p1 + 0.5;
    if (p2 >= 1.0) p2 -= 1.0;

    const d1 = p1 * windowSize + 16;
    const d2 = p2 * windowSize + 16;
    const g1 = 0.5 - 0.5 * Math.cos(2 * Math.PI * p1);
    const g2 = 0.5 - 0.5 * Math.cos(2 * Math.PI * p2);

    output[i] = readRing(d1) * g1 + readRing(d2) * g2;

    phase += phaseStep;
    if (phase >= 1.0) phase -= 1.0;
    if (phase < 0.0) phase += 1.0;
    writeIdx = (writeIdx + 1) % bufSize;
  }
  return output;
}

function encodeMonoWav(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function extractWaveformSamples(samples: Float32Array, bars = 40): number[] {
  if (samples.length === 0) return Array.from({ length: bars }, () => 0.15);
  const blockSize = Math.max(1, Math.floor(samples.length / bars));
  const rawPeaks: number[] = [];
  let maxPeak = 0.01;

  for (let b = 0; b < bars; b++) {
    const start = b * blockSize;
    const end = Math.min(samples.length, start + blockSize);
    let sumSq = 0;
    for (let i = start; i < end; i++) {
      sumSq += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sumSq / Math.max(1, end - start));
    rawPeaks.push(rms);
    if (rms > maxPeak) maxPeak = rms;
  }

  return rawPeaks.map((v) => {
    const norm = v / maxPeak;
    return Number(Math.max(0.12, Math.min(1, norm)).toFixed(3));
  });
}

export async function renderVoiceNoteWithEffect(
  rawBlob: Blob,
  effect: VoiceEffectId
): Promise<{ blob: Blob; waveform: number[]; durationSec: number }> {
  const arrayBuf = await rawBlob.arrayBuffer();
  const decodeCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuf.slice(0));
  } finally {
    await decodeCtx.close().catch(() => {});
  }

  // Downmix to mono for clean processing & compact WAV
  const targetSampleRate = Math.min(24000, decoded.sampleRate);
  const monoLength = decoded.length;
  const mono = new Float32Array(monoLength);
  for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
    const chData = decoded.getChannelData(ch);
    for (let i = 0; i < monoLength; i++) {
      mono[i] += chData[i] / decoded.numberOfChannels;
    }
  }

  const waveform = extractWaveformSamples(mono, 40);

  if (effect === 'normal') {
    // Re-encode to universal 16-bit PCM WAV (16kHz mono) so voice notes open & seek on iOS, Android, and desktop
    const wavSampleRate = Math.min(22050, decoded.sampleRate);
    const outSamples = Math.max(1, Math.ceil(decoded.duration * wavSampleRate));
    const offlineNormal = new OfflineAudioContext(1, outSamples, wavSampleRate);
    const srcBuf = offlineNormal.createBuffer(1, mono.length, decoded.sampleRate);
    srcBuf.copyToChannel(mono, 0);
    const srcNodeNormal = offlineNormal.createBufferSource();
    srcNodeNormal.buffer = srcBuf;
    srcNodeNormal.connect(offlineNormal.destination);
    srcNodeNormal.start(0);
    const renderedNormal = await offlineNormal.startRendering();
    const normalWav = encodeMonoWav(renderedNormal.getChannelData(0), wavSampleRate);
    return {
      blob: normalWav,
      waveform,
      durationSec: Math.max(1, Math.round(decoded.duration)),
    };
  }

  const ratio = getEffectPitchRatio(effect);
  const pitchShifted = applyPitchShiftFloat32(mono, ratio);

  // Add slight tail for echo/alien delay
  const tailSeconds = effect === 'echo' ? 0.65 : effect === 'alien' ? 0.25 : 0.05;
  const totalOutSamples = Math.ceil((decoded.duration + tailSeconds) * targetSampleRate);
  const offline = new OfflineAudioContext(1, totalOutSamples, targetSampleRate);

  const srcBuffer = offline.createBuffer(1, pitchShifted.length, decoded.sampleRate);
  srcBuffer.copyToChannel(new Float32Array(pitchShifted), 0);

  const srcNode = offline.createBufferSource();
  srcNode.buffer = srcBuffer;

  const oscs: OscillatorNode[] = [];
  wireEffectSubgraph(offline, effect, srcNode, offline.destination, oscs);
  srcNode.start(0);

  const rendered = await offline.startRendering();
  const renderedSamples = rendered.getChannelData(0);
  const wavBlob = encodeMonoWav(renderedSamples, targetSampleRate);

  return {
    blob: wavBlob,
    waveform: extractWaveformSamples(renderedSamples, 40),
    durationSec: Math.max(1, Math.round(decoded.duration)),
  };
}
