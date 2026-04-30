// Procedural audio engine using Web Audio API.
// Music: four mood layers (calm / chase / combat / radio) playing in parallel,
// each with its own gain that crossfades to taste. A single short-tail
// convolution reverb is shared across all music layers, and a soft-knee
// compressor sits on the master bus so loud SFX (explosions) don't clip.

export type MusicMood = "calm" | "chase" | "combat" | "radio";

// All mood patterns share the same musical key (A minor pentatonic flavoured)
// so the crossfades don't sound dissonant — switching from radio funk to
// combat metal still resolves to the same root.
const A_MINOR_BASS = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4]; // A1 A1 C2 G1 A1 A1 D2 C2
const A_MINOR_LEAD = [220, 261.6, 329.6, 261.6, 293.7, 329.6, 392, 329.6];
const A_MINOR_CHORDS: number[][] = [
  [110, 164.8, 196], // Am  (A C E)
  [87.3, 130.8, 174.6], // F   (F A C)
  [98, 146.8, 196], // G   (G B D)
  [110, 164.8, 207.6], // Am7 (A C E G#... close enough)
];

export class AudioEngine {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  musicGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  musicReverbSend: GainNode | null = null;
  currentMood: MusicMood = "calm";
  // active music nodes per mood
  moodGains: Partial<Record<MusicMood, GainNode>> = {};
  moodNodes: Partial<Record<MusicMood, AudioNode[]>> = {};
  started = false;
  enabled = true;

  init() {
    if (this.ctx) return;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctx();

      // Master bus: limiter-style compressor → destination so SFX peaks tame.
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.18;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.55;
      this.masterGain.connect(comp);
      comp.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.5;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.7;
      this.sfxGain.connect(this.masterGain);

      // Shared music reverb (small algorithmic IR) on its own send.
      const reverb = this.ctx.createConvolver();
      reverb.buffer = this.makeReverbIR(2.4, 2.5);
      const reverbReturn = this.ctx.createGain();
      reverbReturn.gain.value = 0.35;
      reverb.connect(reverbReturn);
      reverbReturn.connect(this.musicGain);
      this.musicReverbSend = this.ctx.createGain();
      this.musicReverbSend.gain.value = 1;
      this.musicReverbSend.connect(reverb);
    } catch {
      this.enabled = false;
    }
  }

  resume() {
    if (this.ctx?.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  start() {
    if (this.started) return;
    this.init();
    if (!this.ctx || !this.musicGain) return;
    this.started = true;
    this.startMood("calm");
    this.startMood("chase");
    this.startMood("combat");
    this.startMood("radio");
    this.setMood("calm");
  }

  setMaster(v: number) {
    if (this.masterGain) this.masterGain.gain.value = v;
  }
  setMusicVol(v: number) {
    if (this.musicGain) this.musicGain.gain.value = v;
  }
  setSfxVol(v: number) {
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }

  private startMood(mood: MusicMood) {
    if (!this.ctx || !this.musicGain || !this.musicReverbSend) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.musicGain);
    // Wet send: every mood feeds a little bit of itself into the reverb bus.
    const wet = ctx.createGain();
    wet.gain.value = mood === "calm" ? 0.45 : mood === "combat" ? 0.18 : 0.22;
    wet.connect(this.musicReverbSend);
    this.moodGains[mood] = g;

    const nodes: AudioNode[] = [wet];
    const t = ctx.currentTime;

    // ------------------------------------------------------------------
    // CALM — ambient pad + slow chord progression (Am / F / G / Am)
    // ------------------------------------------------------------------
    if (mood === "calm") {
      // Three detuned saws → lowpass with a slow LFO sweep.
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 700;
      lp.Q.value = 1.4;
      const padGain = ctx.createGain();
      padGain.gain.value = 0.18;
      lp.connect(padGain);
      padGain.connect(g);
      padGain.connect(wet);

      const oscs: OscillatorNode[] = [];
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = 110 + (i - 1) * 0.7; // tiny detune for chorus
        o.connect(lp);
        o.start(t);
        oscs.push(o);
      }

      // LFO on filter cutoff for that drifting "wash" feel.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.13;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 250;
      lfo.connect(lfoGain).connect(lp.frequency);
      lfo.start(t);

      // Chord progression — re-pitch the three oscillators every 4 seconds.
      const chordTime = 4;
      const totalBars = 4000; // ~4.4 hours of progression
      for (let bar = 0; bar < totalBars; bar++) {
        const chord = A_MINOR_CHORDS[bar % A_MINOR_CHORDS.length]!;
        const when = t + bar * chordTime;
        for (let i = 0; i < oscs.length; i++) {
          const target = chord[i % chord.length]!;
          // Glide so chord changes don't click.
          oscs[i]!.frequency.setValueAtTime(oscs[i]!.frequency.value, when);
          oscs[i]!.frequency.linearRampToValueAtTime(target + (i - 1) * 0.7, when + 0.6);
        }
      }
      nodes.push(lp, padGain, lfo, lfoGain, ...oscs);
    }

    // ------------------------------------------------------------------
    // CHASE — driving 4/4: bass arp, hi-hat 8ths, snare on 2 + 4
    // ------------------------------------------------------------------
    else if (mood === "chase") {
      const tick = 0.18; // 8th-note duration → ~83 BPM @ quarter note
      const totalBars = 1200; // ~28 minutes

      // Bass — square through a lowpass for that warm growl.
      const bassOsc = ctx.createOscillator();
      bassOsc.type = "square";
      bassOsc.frequency.value = A_MINOR_BASS[0]!;
      const bassLp = ctx.createBiquadFilter();
      bassLp.type = "lowpass";
      bassLp.frequency.value = 600;
      const bassGain = ctx.createGain();
      bassGain.gain.value = 0.32;
      bassOsc.connect(bassLp).connect(bassGain).connect(g);
      for (let bar = 0; bar < totalBars; bar++) {
        for (let i = 0; i < A_MINOR_BASS.length; i++) {
          bassOsc.frequency.setValueAtTime(
            A_MINOR_BASS[i]!,
            t + bar * A_MINOR_BASS.length * tick + i * tick,
          );
        }
      }
      bassOsc.start(t);
      nodes.push(bassOsc, bassLp, bassGain);

      // Hi-hat — short noise bursts on every 8th.
      const hatNoise = this.createNoiseSource();
      const hatHp = ctx.createBiquadFilter();
      hatHp.type = "highpass";
      hatHp.frequency.value = 6500;
      const hatGain = ctx.createGain();
      hatGain.gain.value = 0;
      hatNoise.connect(hatHp).connect(hatGain).connect(g);
      hatNoise.start(t);
      const hatSteps = totalBars * A_MINOR_BASS.length;
      for (let s = 0; s < hatSteps; s++) {
        const when = t + s * tick;
        const accent = s % 2 === 0 ? 0.16 : 0.09;
        hatGain.gain.setValueAtTime(accent, when);
        hatGain.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
      }
      nodes.push(hatNoise, hatHp, hatGain);

      // Snare — noise + tone on beats 2 and 4 (steps 4 and 12 in an 8-step bar).
      const snareNoise = this.createNoiseSource();
      const snareBp = ctx.createBiquadFilter();
      snareBp.type = "bandpass";
      snareBp.frequency.value = 1800;
      snareBp.Q.value = 1.2;
      const snareGain = ctx.createGain();
      snareGain.gain.value = 0;
      snareNoise.connect(snareBp).connect(snareGain).connect(g);
      snareGain.connect(wet);
      snareNoise.start(t);
      for (let bar = 0; bar < totalBars; bar++) {
        const barStart = t + bar * A_MINOR_BASS.length * tick;
        for (const beat of [2, 6]) {
          const when = barStart + beat * tick;
          snareGain.gain.setValueAtTime(0.32, when);
          snareGain.gain.exponentialRampToValueAtTime(0.001, when + 0.14);
        }
      }
      nodes.push(snareNoise, snareBp, snareGain);
    }

    // ------------------------------------------------------------------
    // COMBAT — heavy: kick on every beat, snare on 2/4, distorted lead
    // ------------------------------------------------------------------
    else if (mood === "combat") {
      const tick = 0.15; // ~100 BPM
      const stepsPerBar = 8;
      const totalBars = 1800; // ~36 minutes

      // Kick — sine with pitch envelope, on every quarter (step 0,2,4,6).
      const kickOsc = ctx.createOscillator();
      kickOsc.type = "sine";
      kickOsc.frequency.value = 60;
      const kickGain = ctx.createGain();
      kickGain.gain.value = 0;
      kickOsc.connect(kickGain).connect(g);
      kickOsc.start(t);

      // Snare — noise+body, on backbeats (step 2, 6).
      const snareNoise = this.createNoiseSource();
      const snareBp = ctx.createBiquadFilter();
      snareBp.type = "bandpass";
      snareBp.frequency.value = 2000;
      snareBp.Q.value = 0.9;
      const snareGain = ctx.createGain();
      snareGain.gain.value = 0;
      snareNoise.connect(snareBp).connect(snareGain).connect(g);
      snareGain.connect(wet);
      snareNoise.start(t);

      for (let bar = 0; bar < totalBars; bar++) {
        const barStart = t + bar * stepsPerBar * tick;
        for (let beat = 0; beat < stepsPerBar; beat += 2) {
          const when = barStart + beat * tick;
          // Kick on every quarter
          kickGain.gain.setValueAtTime(0.7, when);
          kickGain.gain.exponentialRampToValueAtTime(0.001, when + 0.14);
          kickOsc.frequency.setValueAtTime(95, when);
          kickOsc.frequency.exponentialRampToValueAtTime(38, when + 0.1);
          // Snare on beats 2, 4 (= step 2, 6)
          if (beat === 2 || beat === 6) {
            snareGain.gain.setValueAtTime(0.42, when);
            snareGain.gain.exponentialRampToValueAtTime(0.001, when + 0.16);
          }
        }
      }
      nodes.push(kickOsc, kickGain, snareNoise, snareBp, snareGain);

      // Distorted lead — saw through waveshaper, plays the lead motif.
      const lead = ctx.createOscillator();
      lead.type = "sawtooth";
      lead.frequency.value = A_MINOR_LEAD[0]!;
      const dist = ctx.createWaveShaper();
      dist.curve = this.makeDistortionCurve(70) as unknown as Float32Array<ArrayBuffer>;
      dist.oversample = "4x";
      const leadLp = ctx.createBiquadFilter();
      leadLp.type = "lowpass";
      leadLp.frequency.value = 2200;
      const leadGain = ctx.createGain();
      leadGain.gain.value = 0.14;
      lead.connect(dist).connect(leadLp).connect(leadGain).connect(g);
      leadGain.connect(wet);
      lead.start(t);
      // Lead melody plays half-time relative to the drums (one note per beat).
      for (let bar = 0; bar < totalBars; bar++) {
        for (let i = 0; i < A_MINOR_LEAD.length; i++) {
          lead.frequency.setValueAtTime(
            A_MINOR_LEAD[i]!,
            t + bar * A_MINOR_LEAD.length * tick * 2 + i * tick * 2,
          );
        }
      }
      nodes.push(lead, dist, leadLp, leadGain);
    }

    // ------------------------------------------------------------------
    // RADIO — funk vibe: walking bass + chord stab on the off-beat
    // ------------------------------------------------------------------
    else if (mood === "radio") {
      const tick = 0.16;
      const stepsPerBar = 8;
      const totalBars = 1500;

      // Walking bass on triangle for a softer pluck.
      const bass = ctx.createOscillator();
      bass.type = "triangle";
      bass.frequency.value = 110;
      const bassGain = ctx.createGain();
      bassGain.gain.value = 0.3;
      bass.connect(bassGain).connect(g);
      bass.start(t);
      const bassPattern = [110, 110, 146.8, 110, 130.8, 110, 98, 130.8];
      for (let bar = 0; bar < totalBars; bar++) {
        for (let i = 0; i < bassPattern.length; i++) {
          bass.frequency.setValueAtTime(
            bassPattern[i]!,
            t + bar * stepsPerBar * tick + i * tick,
          );
        }
      }

      // Chord stab — short triangle blip on the off-beats (step 1,3,5,7).
      const stab = ctx.createOscillator();
      stab.type = "square";
      stab.frequency.value = 440;
      const stabLp = ctx.createBiquadFilter();
      stabLp.type = "lowpass";
      stabLp.frequency.value = 1800;
      const stabGain = ctx.createGain();
      stabGain.gain.value = 0;
      stab.connect(stabLp).connect(stabGain).connect(g);
      stabGain.connect(wet);
      stab.start(t);
      const stabNotes = [440, 523.3, 587.3, 523.3];
      for (let bar = 0; bar < totalBars; bar++) {
        const barStart = t + bar * stepsPerBar * tick;
        for (let i = 0; i < 4; i++) {
          const when = barStart + (i * 2 + 1) * tick;
          stab.frequency.setValueAtTime(stabNotes[i % stabNotes.length]!, when);
          stabGain.gain.setValueAtTime(0.18, when);
          stabGain.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
        }
      }
      nodes.push(bass, bassGain, stab, stabLp, stabGain);

      // Subtle hi-hat shaker for groove.
      const shake = this.createNoiseSource();
      const shakeHp = ctx.createBiquadFilter();
      shakeHp.type = "highpass";
      shakeHp.frequency.value = 7000;
      const shakeGain = ctx.createGain();
      shakeGain.gain.value = 0;
      shake.connect(shakeHp).connect(shakeGain).connect(g);
      shake.start(t);
      for (let bar = 0; bar < totalBars; bar++) {
        for (let i = 0; i < stepsPerBar; i++) {
          const when = t + bar * stepsPerBar * tick + i * tick;
          shakeGain.gain.setValueAtTime(i % 2 === 1 ? 0.1 : 0.05, when);
          shakeGain.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
        }
      }
      nodes.push(shake, shakeHp, shakeGain);
    }
    this.moodNodes[mood] = nodes;
  }

  private createNoiseSource(): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  // Cheap algorithmic reverb impulse response — exponential-decay noise.
  private makeReverbIR(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const env = Math.pow(1 - i / len, decay);
        data[i] = (Math.random() * 2 - 1) * env;
      }
    }
    return buf;
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const k = amount;
    const n = 4096;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  setMood(mood: MusicMood) {
    if (!this.ctx || mood === this.currentMood) return;
    const fadeTime = 1.5;
    const t = this.ctx.currentTime;
    for (const m of ["calm", "chase", "combat", "radio"] as MusicMood[]) {
      const g = this.moodGains[m];
      if (!g) continue;
      const target = m === mood ? 1 : 0;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(target, t + fadeTime);
    }
    this.currentMood = mood;
  }

  // ---- SFX ----
  // Short, dull thud — a body-impact "punch" sound. A low triangle thump
  // layered with a tiny burst of low-pass-filtered noise to suggest the
  // air-displacement whoosh and the cloth/skin contact.
  playPunch() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    // Thump: low triangle pitch-drop
    const o = this.ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.sfxGain);
    o.start(t);
    o.stop(t + 0.13);
    // Whoosh: low-passed noise tail
    const noise = this.createNoiseSource();
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.18, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    noise.connect(lp).connect(ng).connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.12);
  }

  playGunshot() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(800, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.sfxGain);
    o.start(t);
    o.stop(t + 0.15);
    const noise = this.createNoiseSource();
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1000;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.3, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    noise.connect(hp).connect(ng).connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.15);
  }

  playExplosion() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const noise = this.createNoiseSource();
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(2000, t);
    lp.frequency.exponentialRampToValueAtTime(100, t + 0.6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    noise.connect(lp).connect(g).connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.9);
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.4);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.7, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(og).connect(this.sfxGain);
    o.start(t);
    o.stop(t + 0.5);
  }

  playCarHit(intensity = 0.5) {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const noise = this.createNoiseSource();
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 600;
    bp.Q.value = 1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5 * intensity, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    noise.connect(bp).connect(g).connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.35);
  }

  playSiren() {
    // Continuous siren handled by mood; this is a one-shot blip if needed
  }

  playDamageGrunt() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(this.sfxGain);
    o.start(t);
    o.stop(t + 0.3);
  }

  playPickup() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(660, t);
    o.frequency.exponentialRampToValueAtTime(1320, t + 0.15);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(this.sfxGain);
    o.start(t);
    o.stop(t + 0.25);
  }

  playEngine(rpm: number) {
    void rpm;
  }
}

export const audioEngine = new AudioEngine();
