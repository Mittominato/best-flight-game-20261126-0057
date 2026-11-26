// All sound is synthesised with WebAudio: an engine drone that follows the
// RPM, wind that follows the airspeed, and short cues for rings, landings
// and crashes. No audio files, no network. The context starts on the first
// user gesture, as browsers require.
export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windSource = null;
  let windFilter = null;
  let windGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      context = new AC();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);

      // Engine: two detuned saws through a low-pass, pitch follows RPM.
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = context.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 82;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();

      // Wind: looped noise through a band-pass, loudness follows airspeed.
      const noiseLen = context.sampleRate * 2;
      const noiseBuf = context.createBuffer(1, noiseLen, context.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = context.createBufferSource();
      windSource.buffer = noiseBuf;
      windSource.loop = true;
      windFilter = context.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windFilter.Q.value = 0.6;
      windGain = context.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSource.start();

      started = true;
      return true;
    } catch {
      return false;
    }
  }

  /** Call on every user gesture; also resumes after the tab was hidden. */
  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  /** Continuous engine and wind levels, called every frame while flying. */
  function update(rpm, speed, flying) {
    if (!started) return;
    const t = context.currentTime;
    engineOsc.frequency.setTargetAtTime(48 + rpm * 95, t, 0.08);
    engineOsc2.frequency.setTargetAtTime(72 + rpm * 140, t, 0.08);
    engineGain.gain.setTargetAtTime(flying ? 0.05 + rpm * 0.11 : 0.02 + rpm * 0.05, t, 0.1);
    const wind = Math.min(1, speed / 85);
    windGain.gain.setTargetAtTime(flying ? wind * wind * 0.16 : 0, t, 0.15);
    windFilter.frequency.setTargetAtTime(300 + wind * 900, t, 0.15);
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!started) return;
    const t = context.currentTime + when;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noiseBurst(dur, vol, freq) {
    if (!started) return;
    const t = context.currentTime;
    const len = Math.floor(context.sampleRate * dur);
    const buf = context.createBuffer(1, len, context.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = context.createBufferSource();
    src.buffer = buf;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = context.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  return {
    unlock,
    update,
    ring() {
      tone(880, 0.35, 'sine', 0.22);
      tone(1318, 0.5, 'sine', 0.18, 0.07);
    },
    click() {
      tone(660, 0.08, 'square', 0.08);
    },
    thud() {
      tone(70, 0.3, 'sine', 0.35);
      noiseBurst(0.18, 0.2, 400);
    },
    scrape() {
      noiseBurst(0.35, 0.25, 900);
    },
    crash() {
      noiseBurst(0.7, 0.5, 500);
      tone(55, 0.8, 'sawtooth', 0.3);
    },
    stall() {
      tone(440, 0.25, 'square', 0.07);
      tone(415, 0.25, 'square', 0.07, 0.28);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
