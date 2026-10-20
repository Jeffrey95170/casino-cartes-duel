export type SoundCue = "select" | "card" | "capture" | "build" | "deal" | "win" | "finish";
export type AudioPreferences = { music: boolean; effects: boolean; musicVolume: number; effectsVolume: number };
export const DEFAULT_AUDIO: AudioPreferences = { music: false, effects: false, musicVolume: 30, effectsVolume: 55 };
export const AUDIO_STORAGE_KEY = "capture52:audio:v1";

export function parseAudioPreferences(value: string | null): AudioPreferences {
  try {
    const saved = JSON.parse(value ?? "null");
    const volume = (key: "musicVolume" | "effectsVolume") => typeof saved?.[key] === "number" && Number.isFinite(saved[key]) ? Math.min(100, Math.max(0, saved[key])) : DEFAULT_AUDIO[key];
    return { music: saved?.music === true, effects: saved?.effects === true, musicVolume: volume("musicVolume"), effectsVolume: volume("effectsVolume") };
  } catch { return { ...DEFAULT_AUDIO }; }
}

// Original procedural lounge arrangement: no external recordings or downloads.
const CHORDS = [[50, 57, 60, 64, 69], [43, 55, 59, 64, 65], [48, 55, 59, 62, 67], [45, 57, 61, 64, 67]];
const midiFrequency = (note: number) => 440 * 2 ** ((note - 69) / 12);

export class GameAudio {
  private context: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private preferences = { ...DEFAULT_AUDIO };
  private beat = 0;
  private nextBeat = 0;
  private musicSources = new Set<OscillatorNode>();

  async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.musicBus = this.context.createGain();
      this.effectsBus = this.context.createGain();
      this.musicBus.connect(this.context.destination);
      this.effectsBus.connect(this.context.destination);
    }
    if (this.context.state !== "running") await this.context.resume();
    this.configure(this.preferences);
  }

  configure(preferences: AudioPreferences) {
    this.preferences = preferences;
    if (!this.context || !this.musicBus || !this.effectsBus) return;
    const now = this.context.currentTime;
    this.musicBus.gain.setTargetAtTime(preferences.music ? preferences.musicVolume / 100 * 0.42 : 0, now, 0.05);
    this.effectsBus.gain.setTargetAtTime(preferences.effects ? preferences.effectsVolume / 100 * 0.5 : 0, now, 0.02);
    if (preferences.music && this.context.state === "running" && !document.hidden) this.startMusic();
    else this.stopMusic();
  }

  private note(bus: GainNode, frequency: number, start: number, duration: number, volume: number, type: OscillatorType = "sine", music = false) {
    if (!this.context) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(bus);
    if (music) this.musicSources.add(oscillator);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); this.musicSources.delete(oscillator); };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.025);
  }

  private shuffle(start: number) {
    if (!this.context || !this.effectsBus) return;
    const buffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * 0.12), this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 3 * 0.16;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = 1600;
    source.connect(filter); filter.connect(this.effectsBus);
    source.onended = () => { source.disconnect(); filter.disconnect(); };
    source.start(start);
  }

  play(cue: SoundCue) {
    if (!this.preferences.effects || this.context?.state !== "running" || !this.effectsBus || document.hidden) return;
    const now = this.context.currentTime;
    if (cue === "card" || cue === "deal") {
      for (let i = 0; i < (cue === "deal" ? 4 : 1); i++) this.shuffle(now + i * 0.075);
      return;
    }
    const notes = cue === "win" ? [72, 76, 79, 84] : cue === "capture" ? [84, 88, 91] : cue === "build" ? [67, 74] : cue === "finish" ? [64, 60, 57] : [86];
    notes.forEach((note, index) => this.note(this.effectsBus!, midiFrequency(note), now + index * 0.085, cue === "select" ? 0.045 : 0.4, cue === "select" ? 0.08 : 0.17, "sine"));
  }

  private startMusic() {
    if (this.timer || !this.context || !this.musicBus) return;
    this.nextBeat = this.context.currentTime + 0.04;
    const schedule = () => {
      if (!this.context || !this.musicBus || this.context.state !== "running") return;
      // Never catch up a long background pause by scheduling a burst of notes.
      this.nextBeat = Math.max(this.nextBeat, this.context.currentTime);
      while (this.nextBeat < this.context.currentTime + 0.3) {
        const chord = CHORDS[Math.floor(this.beat / 8) % CHORDS.length];
        const localBeat = this.beat % 8;
        if (localBeat % 4 === 0) chord.slice(1).forEach((note, index) => this.note(this.musicBus!, midiFrequency(note), this.nextBeat + index * 0.018, 2.2, 0.07, "sine", true));
        this.note(this.musicBus, midiFrequency(chord[0] - (localBeat % 2 ? 0 : 12)), this.nextBeat, 0.6, 0.12, "triangle", true);
        if (localBeat % 2) this.note(this.musicBus, midiFrequency(chord[2 + localBeat % 3] + 12), this.nextBeat + 0.16, 0.65, 0.05, "sine", true);
        this.beat++;
        this.nextBeat += 60 / 78;
      }
    };
    schedule();
    this.timer = setInterval(schedule, 120);
  }

  private stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const source of this.musicSources) source.stop();
    this.musicSources.clear();
  }

  async visibilityChanged() {
    if (!this.context) return;
    if (document.hidden) { this.stopMusic(); await this.context.suspend(); }
    else if (this.preferences.music || this.preferences.effects) await this.unlock();
  }

  dispose() {
    this.stopMusic();
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }
}
