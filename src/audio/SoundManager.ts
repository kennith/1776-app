/**
 * Procedural Audio Synthesizer for 1776 Game (Web Audio API)
 * Generates historical fife & drum march, footsteps, wind ambience, musket/rifle shots,
 * sword swings, pistol cracks, tools, and grenade explosions.
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private musicGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;
  private ambientGainNode: GainNode | null = null;
  private musicInterval: number | null = null;
  private windNode: AudioNode | null = null;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      
      this.musicGainNode = this.ctx.createGain();
      this.musicGainNode.gain.value = 0.25;
      this.musicGainNode.connect(this.ctx.destination);

      this.sfxGainNode = this.ctx.createGain();
      this.sfxGainNode.gain.value = 0.4;
      this.sfxGainNode.connect(this.ctx.destination);

      this.ambientGainNode = this.ctx.createGain();
      this.ambientGainNode.gain.value = 0.15;
      this.ambientGainNode.connect(this.ctx.destination);

      this.startAmbientWind();
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.ctx && this.ctx.state === 'running') {
      if (this.isMuted) {
        this.ctx.suspend();
      } else {
        this.ctx.resume();
      }
    } else if (this.ctx && this.ctx.state === 'suspended' && !this.isMuted) {
      this.ctx.resume();
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Plays a colonial drum snare strike
   */
  public playDrum(type: 'snare' | 'bass' = 'snare', accent: number = 1.0) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    if (type === 'snare') {
      const bufferSize = this.ctx.sampleRate * 0.08;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1000, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3 * accent, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      whiteNoise.connect(filter);
      filter.connect(gain);
      if (this.musicGainNode) gain.connect(this.musicGainNode);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.1);
    } else {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);

      gain.gain.setValueAtTime(0.5 * accent, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      if (this.musicGainNode) gain.connect(this.musicGainNode);

      osc.start(now);
      osc.stop(now + 0.2);
    }
  }

  /**
   * Plays a colonial fife note
   */
  public playFifeNote(freq: number, duration: number = 0.25) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    if (this.musicGainNode) gain.connect(this.musicGainNode);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  }

  /**
   * Starts procedural 1776 martial march (Yankee Doodle)
   */
  public startPatrioticTheme() {
    this.stopPatrioticTheme();
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    const melody = [
      523.25, 523.25, 587.33, 659.25, 523.25, 659.25, 587.33, 392.00,
      523.25, 523.25, 587.33, 659.25, 523.25, 493.88, 523.25, 0,
      523.25, 523.25, 587.33, 659.25, 698.46, 659.25, 587.33, 523.25,
      493.88, 392.00, 440.00, 493.88, 523.25, 523.25, 523.25, 0
    ];

    let step = 0;
    const tempoMs = 180;

    this.musicInterval = window.setInterval(() => {
      if (this.isMuted || !this.ctx) return;

      const note = melody[step % melody.length];
      if (note > 0) {
        this.playFifeNote(note, 0.22);
      }

      if (step % 4 === 0) {
        this.playDrum('bass', 0.8);
      } else {
        this.playDrum('snare', (step % 2 === 0) ? 0.6 : 0.35);
      }

      if (step % 8 === 7) {
        setTimeout(() => this.playDrum('snare', 0.5), 60);
      }

      step++;
    }, tempoMs);
  }

  public stopPatrioticTheme() {
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  private startAmbientWind() {
    if (!this.ctx || this.windNode) return;
    try {
      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(gain);
      if (this.ambientGainNode) gain.connect(this.ambientGainNode);

      whiteNoise.start();
      this.windNode = whiteNoise;
    } catch (e) {
      console.warn('Failed to start wind audio:', e);
    }
  }

  public playFootstep() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    const pitch = 60 + Math.random() * 25;
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.08);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, now);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    if (this.sfxGainNode) gain.connect(this.sfxGainNode);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Musket / Springfield rifle gunshot
   */
  public playMusketFire() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(1400, now);
    clickGain.gain.setValueAtTime(0.2, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    clickOsc.connect(clickGain);
    if (this.sfxGainNode) clickGain.connect(this.sfxGainNode);
    clickOsc.start(now);
    clickOsc.stop(now + 0.03);

    const bufferSize = this.ctx.sampleRate * 0.6;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }

    const blast = this.ctx.createBufferSource();
    blast.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now + 0.02);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.5);

    const blastGain = this.ctx.createGain();
    blastGain.gain.setValueAtTime(0.8, now + 0.02);
    blastGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    blast.connect(filter);
    filter.connect(blastGain);
    if (this.sfxGainNode) blastGain.connect(this.sfxGainNode);

    blast.start(now + 0.02);
    blast.stop(now + 0.6);
  }

  /**
   * Plays paper cartridge / ramrod reload sound
   */
  public playReloadSound() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Ramrod metallic scrape
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.linearRampToValueAtTime(1400, now + 0.3);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    noise.connect(filter);
    filter.connect(gain);
    if (this.sfxGainNode) gain.connect(this.sfxGainNode);
    noise.start(now);
    noise.stop(now + 0.3);
  }

  /**
   * Plays flintlock cocking click when ready
   */
  public playReloadComplete() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    if (this.sfxGainNode) gain.connect(this.sfxGainNode);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Kentucky Long Rifle high-velocity sharp crack
   */
  public playRifleCrack() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const crackOsc = this.ctx.createOscillator();
    const crackGain = this.ctx.createGain();
    crackOsc.type = 'sawtooth';
    crackOsc.frequency.setValueAtTime(2200, now);
    crackOsc.frequency.exponentialRampToValueAtTime(150, now + 0.2);
    crackGain.gain.setValueAtTime(0.7, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    crackOsc.connect(crackGain);
    if (this.sfxGainNode) crackGain.connect(this.sfxGainNode);
    crackOsc.start(now);
    crackOsc.stop(now + 0.4);

    this.playMusketFire();
  }

  /**
   * Steel sword / blade slash swoosh
   */
  public playSwordSlash() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.linearRampToValueAtTime(3200, now + 0.1);
    filter.frequency.linearRampToValueAtTime(600, now + 0.25);
    filter.Q.value = 4.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    if (this.sfxGainNode) gain.connect(this.sfxGainNode);

    noise.start(now);
    noise.stop(now + 0.25);
  }

  /**
   * Flintlock pistol shot
   */
  public playPistolShot() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    if (this.sfxGainNode) gain.connect(this.sfxGainNode);

    osc.start(now);
    osc.stop(now + 0.2);

    this.playMusketFire();
  }

  /**
   * Grenade explosion sound
   */
  public playExplosion() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.8);

    gain.gain.setValueAtTime(1.0, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc.connect(gain);
    if (this.sfxGainNode) gain.connect(this.sfxGainNode);
    osc.start(now);
    osc.stop(now + 0.9);

    // Boom rumble
    const bufferSize = this.ctx.sampleRate * 0.9;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, now);
    filter.frequency.exponentialRampToValueAtTime(60, now + 0.9);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.9, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    noise.connect(filter);
    filter.connect(nGain);
    if (this.sfxGainNode) nGain.connect(this.sfxGainNode);
    noise.start(now);
    noise.stop(now + 0.9);
  }

  /**
   * Tool swing / heal sound
   */
  public playToolAction(type: 'axe' | 'shovel' | 'pickaxe' | 'med_kit') {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    if (type === 'med_kit') {
      // Pleasant healing chime
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.linearRampToValueAtTime(783.99, now + 0.2);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      if (this.sfxGainNode) gain.connect(this.sfxGainNode);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'axe') {
      // Powerful timber cleave: air whoosh + heavy steel impact
      this.playSwordSlash();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.22);
      gain.gain.setValueAtTime(0.55, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      if (this.sfxGainNode) gain.connect(this.sfxGainNode);
      osc.start(now + 0.05);
      osc.stop(now + 0.25);
    } else if (type === 'pickaxe') {
      // Crisp metallic stone clink + heavy resonance
      this.playSwordSlash();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now + 0.04);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.22);
      gain.gain.setValueAtTime(0.6, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      if (this.sfxGainNode) gain.connect(this.sfxGainNode);
      osc.start(now + 0.04);
      osc.stop(now + 0.25);
    } else {
      // Shovel earth digging scrape & thud
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      if (this.sfxGainNode) gain.connect(this.sfxGainNode);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  }

  /**
   * Sharp wood chopping hit effect (axe biting into tree trunk)
   */
  public playWoodChopHit() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 1. High frequency wood splinter crack
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    if (this.sfxGainNode) gain.connect(this.sfxGainNode);
    osc.start(now);
    osc.stop(now + 0.14);

    // 2. Resonant solid log core thud
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(160, now);
    osc2.frequency.exponentialRampToValueAtTime(30, now + 0.18);
    gain2.gain.setValueAtTime(0.65, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc2.connect(gain2);
    if (this.sfxGainNode) gain2.connect(this.sfxGainNode);
    osc2.start(now);
    osc2.stop(now + 0.18);
  }

  /**
   * Frontier carpentry hammer nail strike sound
   */
  public playHammerStrike() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Metallic hammer clang
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1450 + (Math.random() - 0.5) * 160, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.08);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    if (this.sfxGainNode) gain.connect(this.sfxGainNode);
    osc.start(now);
    osc.stop(now + 0.08);

    // Solid wood beam impact thud
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(220, now);
    osc2.frequency.exponentialRampToValueAtTime(45, now + 0.14);
    gain2.gain.setValueAtTime(0.6, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc2.connect(gain2);
    if (this.sfxGainNode) gain2.connect(this.sfxGainNode);
    osc2.start(now);
    osc2.stop(now + 0.14);
  }

  /**
   * Construction finished fanfare / wood placement thud
   */
  public playConstructionComplete() {
    if (!this.ctx || this.isMuted) return;

    // Double heavy mallet strike
    this.playHammerStrike();
    setTimeout(() => {
      this.playHammerStrike();
    }, 120);
  }

  /**
   * Tree falling / breaking sound (timber creak & heavy ground crash)
   */
  public playTreeFell() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Wood snapping creak
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.4);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.85);
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc.connect(gain);
    if (this.sfxGainNode) gain.connect(this.sfxGainNode);
    osc.start(now);
    osc.stop(now + 0.85);

    // Ground impact thud
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(90, now + 0.35);
    osc2.frequency.exponentialRampToValueAtTime(20, now + 0.9);
    gain2.gain.setValueAtTime(0.8, now + 0.35);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc2.connect(gain2);
    if (this.sfxGainNode) gain2.connect(this.sfxGainNode);
    osc2.start(now + 0.35);
    osc2.stop(now + 0.9);
  }

  public playClick() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.06);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    if (this.sfxGainNode) gain.connect(this.sfxGainNode);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Wood harvest & inventory item pickup chime
   */
  public playWoodHarvest() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(659.25, now + 0.08); // A4 -> E5 pleasant chime
    osc.frequency.linearRampToValueAtTime(880, now + 0.16);    // E5 -> A5
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  /**
   * Water splash and swimming stroke acoustics
   */
  public playWaterSplash() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.22);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now);
    filter.frequency.exponentialRampToValueAtTime(160, now + 0.22);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    noise.connect(filter);
    filter.connect(gain);
    if (this.sfxGainNode) gain.connect(this.sfxGainNode);
    noise.start(now);
    noise.stop(now + 0.22);
  }

  /**
   * Gasping for air when surfacing
   */
  public playGasp() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.linearRampToValueAtTime(440, now + 0.25);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    if (this.sfxGainNode) gain.connect(this.sfxGainNode);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Heavy fall impact & damage thud
   */
  public playFallDamage() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.28);
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  /**
   * Somber death toll & military casualty chime
   */
  public playDeath() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 1.8);
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    osc.connect(gain);
    if (this.sfxGainNode) gain.connect(this.sfxGainNode);
    osc.start(now);
    osc.stop(now + 1.8);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(116.54, now);
    osc2.frequency.exponentialRampToValueAtTime(58, now + 1.6);
    gain2.gain.setValueAtTime(0.4, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
    osc2.connect(gain2);
    if (this.sfxGainNode) gain2.connect(this.sfxGainNode);
    osc2.start(now);
    osc2.stop(now + 1.6);
  }

  /**
   * Construction hammer & timber placement thud
   */
  public playBuildPlace() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    if (this.sfxGainNode) gain.connect(this.sfxGainNode);
    osc.start(now);
    osc.stop(now + 0.22);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now);
    osc2.frequency.exponentialRampToValueAtTime(440, now + 0.12);
    gain2.gain.setValueAtTime(0.3, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc2.connect(gain2);
    if (this.sfxGainNode) gain2.connect(this.sfxGainNode);
    osc2.start(now);
    osc2.stop(now + 0.14);
  }

  /**
   * Insufficient wood / invalid build placement buzzer
   */
  public playCantBuild() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.setValueAtTime(130, now + 0.08);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    if (this.sfxGainNode) gain.connect(this.sfxGainNode);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}

export const soundManager = new SoundManager();
