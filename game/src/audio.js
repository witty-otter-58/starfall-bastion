// Every sound the game makes, synthesized with WebAudio: no audio files, nothing to download.
// A tiny synth per effect (oscillator blips, filtered noise for explosions, two-note coin chimes)
// plus a quiet ambient pad that hums under the game. All of it is optional and muted with M.
const NOTE = { C4: 261.63, E4: 329.63, G4: 392.0, A4: 440.0, C5: 523.25, E5: 659.25, G5: 783.99 };

export function makeAudio() {
  const state = { ctx: null, master: null, musicGain: null, muted: false, musicOn: false };

  function ensure() {
    if (state.ctx) return state.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    state.ctx = ctx;
    state.master = ctx.createGain();
    state.master.gain.value = 0.5;
    state.master.connect(ctx.destination);
    state.musicGain = ctx.createGain();
    state.musicGain.gain.value = 0.05;
    state.musicGain.connect(state.master);
    return ctx;
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    const ctx = ensure();
    if (!ctx || state.muted) return;
    const t0 = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol || 0.12, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(state.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, freq) {
    const ctx = ensure();
    if (!ctx || state.muted) return;
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq || 800;
    const gain = ctx.createGain();
    gain.gain.value = vol || 0.2;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(state.master);
    src.start(t0);
  }

  function startMusic() {
    const ctx = ensure();
    if (!ctx || state.musicOn || state.muted) return;
    state.musicOn = true;
    // Two slow detuned sines a fifth apart, breathing through a low-pass filter: a pad that
    // never resolves, so it sits under the game without pulling attention.
    const pad = (freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.25;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      osc.connect(g);
      g.connect(state.musicGain);
      osc.start();
      lfo.start();
    };
    pad(110);
    pad(164.81);
    pad(220);
  }

  return {
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      startMusic();
    },
    setMuted(muted) {
      state.muted = muted;
      if (state.master) state.master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() { return state.muted; },
    shoot(kind) {
      if (kind === 'rail') tone(880, 0.18, 'sawtooth', 0.14, 0, 110);
      else if (kind === 'cannon') { tone(160, 0.16, 'triangle', 0.2, 0, 60); noise(0.12, 0.12, 500); }
      else if (kind === 'frost') tone(1200, 0.12, 'sine', 0.08, 0, 1600);
      else if (kind === 'coil') tone(1400, 0.09, 'square', 0.07, 0, 300);
      else tone(660, 0.07, 'square', 0.07, 0, 440);
    },
    explosion() { noise(0.3, 0.25, 600); tone(90, 0.25, 'sine', 0.2, 0, 40); },
    coin() { tone(NOTE.E5, 0.07, 'sine', 0.1); tone(NOTE.G5, 0.12, 'sine', 0.1, 0.06); },
    leak() { tone(220, 0.3, 'sawtooth', 0.2, 0, 110); tone(165, 0.3, 'sawtooth', 0.15, 0.1, 82); },
    horn() { tone(196, 0.5, 'sawtooth', 0.12, 0, 196); tone(294, 0.5, 'sawtooth', 0.1, 0.05, 294); },
    build() { tone(NOTE.C4, 0.08, 'triangle', 0.12); tone(NOTE.G4, 0.1, 'triangle', 0.12, 0.07); },
    upgrade() { tone(NOTE.C5, 0.09, 'triangle', 0.12); tone(NOTE.E5, 0.09, 'triangle', 0.12, 0.08); tone(NOTE.G5, 0.14, 'triangle', 0.12, 0.16); },
    win() { [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, i * 0.12)); },
    lose() { [NOTE.A4, NOTE.G4, NOTE.E4, NOTE.C4].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.1, i * 0.18)); },
  };
}
