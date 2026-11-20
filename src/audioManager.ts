import type { RoomId } from './types.ts';

export interface RoomAudioProfile {
  roomId: RoomId;
  title: string;
  subtitle: string;
  baseDroneHz: number;
  fifthDroneHz: number;
  roomToneFilterHz: number;
  roomToneGain: number;
  scaleHz: number[];
  tempoMs: number;
  bellAttackSec: number;
  bellDecaySec: number;
  overtoneRatio: number;
}

/**
 * Room-specific atmospheric soundscape & traditional Nusantara Gamelan profiles
 * for each of the 5 gallery rooms.
 */
export const ROOM_AUDIO_PROFILES: Record<RoomId, RoomAudioProfile> = {
  ruang_1: {
    roomId: 'ruang_1',
    title: 'Gamelan Pelog Selisir & Serambi Museum',
    subtitle: 'Dengung Gong Ageng lembut & bilah perunggu Pelog penyambut tamu',
    baseDroneHz: 110.0, // A2 Gong Ageng resonance
    fifthDroneHz: 164.81, // E3
    roomToneFilterHz: 240,
    roomToneGain: 0.018,
    scaleHz: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25], // Pelog Selisir nuances
    tempoMs: 2800,
    bellAttackSec: 0.035,
    bellDecaySec: 3.4,
    overtoneRatio: 2.756,
  },
  ruang_2: {
    roomId: 'ruang_2',
    title: 'Room Tone Galeri & Gender Slendro Halus',
    subtitle: 'Akustik ruang lukisan tenang dengan denting Gender Slendro',
    baseDroneHz: 146.83, // D3
    fifthDroneHz: 220.0, // A3
    roomToneFilterHz: 185,
    roomToneGain: 0.014,
    scaleHz: [293.66, 336.0, 384.0, 440.0, 504.0, 587.33], // Slendro 5-tone equidistant
    tempoMs: 3300,
    bellAttackSec: 0.045,
    bellDecaySec: 3.8,
    overtoneRatio: 2.4,
  },
  ruang_3: {
    roomId: 'ruang_3',
    title: 'Gamelan Degung & Akustik Hall Kubah',
    subtitle: 'Resonansi hall patung berkubah dengan laras Degung Sunda',
    baseDroneHz: 130.81, // C3
    fifthDroneHz: 196.0, // G3
    roomToneFilterHz: 280,
    roomToneGain: 0.02,
    scaleHz: [261.63, 293.66, 349.23, 392.0, 493.88, 523.25], // Degung pentatonic
    tempoMs: 2600,
    bellAttackSec: 0.03,
    bellDecaySec: 4.1,
    overtoneRatio: 2.92,
  },
  ruang_4: {
    roomId: 'ruang_4',
    title: 'Petikan Sasando Lontar & Rindik Warisan',
    subtitle: 'Harmoni hangat tekstil & warisan budaya timur-barat Nusantara',
    baseDroneHz: 164.81, // E3
    fifthDroneHz: 246.94, // B3
    roomToneFilterHz: 210,
    roomToneGain: 0.015,
    scaleHz: [329.63, 369.99, 440.0, 493.88, 587.33, 659.25],
    tempoMs: 2400,
    bellAttackSec: 0.02,
    bellDecaySec: 2.9,
    overtoneRatio: 2.0,
  },
  ruang_5: {
    roomId: 'ruang_5',
    title: 'Gong Keraton Agung & Harmoni Paviliun',
    subtitle: 'Atmosfer meditatif paviliun puncak dengan gema Kenong Keraton',
    baseDroneHz: 98.0, // G2 deep royal gong
    fifthDroneHz: 146.83, // D3
    roomToneFilterHz: 160,
    roomToneGain: 0.016,
    scaleHz: [246.94, 277.18, 329.63, 369.99, 440.0, 493.88], // Pelog Barang
    tempoMs: 3600,
    bellAttackSec: 0.05,
    bellDecaySec: 4.5,
    overtoneRatio: 2.756,
  },
};

export function getRoomAudioProfile(room: RoomId): RoomAudioProfile {
  return ROOM_AUDIO_PROFILES[room] || ROOM_AUDIO_PROFILES.ruang_1;
}

/**
 * Lightweight, zero-dependency Web Audio API synthesizer that produces subtle museum
 * room-tone acoustics and room-adaptive traditional Indonesian Gamelan chimes.
 * Automatically plays upon entering the 360 viewer and supports live volume & mute controls.
 */
export class BackgroundAudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private roomToneFilter: BiquadFilterNode | null = null;
  private roomToneGainNode: GainNode | null = null;
  private subDroneOsc: OscillatorNode | null = null;
  private fifthDroneOsc: OscillatorNode | null = null;
  private droneGainNode: GainNode | null = null;

  private currentRoom: RoomId = 'ruang_1';
  private muted = false;
  private volumePercent = 70; // 0..100
  private initialized = false;
  private chimeTimerId: number | null = null;
  private noteStepIndex = 0;

  private onStateChange?: (playing: boolean, profile: RoomAudioProfile) => void;

  constructor(
    initialRoom: RoomId = 'ruang_1',
    initialMuted = false,
    onStateChange?: (playing: boolean, profile: RoomAudioProfile) => void,
    initialVolumePercent = 70,
  ) {
    this.currentRoom = initialRoom;
    this.muted = initialMuted;
    this.volumePercent = Math.max(0, Math.min(100, initialVolumePercent));
    this.onStateChange = onStateChange;
    this.setupAutoPlayAndUnlock();
  }

  private getEffectiveGain(): number {
    if (this.muted || this.volumePercent <= 0) return 0.0001;
    // Map 0..100% to a subtle, gallery-appropriate gain curve (0.0 .. 0.75)
    return Math.max(0.0001, (this.volumePercent / 100) * 0.75);
  }

  private setupAutoPlayAndUnlock() {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      if (!this.muted && !this.initialized) {
        this.startOrResume();
      } else if (this.ctx && this.ctx.state === 'suspended' && !this.muted) {
        void this.ctx.resume().then(() => {
          this.scheduleNextGamelanNote();
          this.notifyState();
        });
      }
    };

    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
  }

  public isPlaying(): boolean {
    return Boolean(
      this.initialized &&
        !this.muted &&
        this.volumePercent > 0 &&
        this.ctx &&
        this.ctx.state === 'running',
    );
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getVolume(): number {
    return this.volumePercent;
  }

  public setVolume(volumePercent: number) {
    this.volumePercent = Math.max(0, Math.min(100, Math.round(volumePercent)));
    if (this.volumePercent > 0 && this.muted) {
      this.muted = false;
    }
    if (!this.initialized && !this.muted && this.volumePercent > 0) {
      this.startOrResume();
    }
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.getEffectiveGain(), now, 0.15);
    }
    this.notifyState();
  }

  public getCurrentProfile(): RoomAudioProfile {
    return getRoomAudioProfile(this.currentRoom);
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.muted) {
      if (this.masterGain && this.ctx) {
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(0.0001, now, 0.15);
      }
      if (this.chimeTimerId !== null) {
        window.clearTimeout(this.chimeTimerId);
        this.chimeTimerId = null;
      }
    } else {
      if (this.volumePercent === 0) {
        this.volumePercent = 70;
      }
      this.startOrResume();
      if (this.masterGain && this.ctx) {
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(this.getEffectiveGain(), now, 0.25);
      }
      this.scheduleNextGamelanNote();
      this.playInteractionChime('portal');
    }
    this.notifyState();
  }

  public toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public setRoom(room: RoomId) {
    const prevRoom = this.currentRoom;
    this.currentRoom = room;
    const profile = getRoomAudioProfile(room);

    if (this.initialized && this.ctx && !this.muted) {
      const now = this.ctx.currentTime;
      if (this.roomToneFilter) {
        this.roomToneFilter.frequency.cancelScheduledValues(now);
        this.roomToneFilter.frequency.setTargetAtTime(
          profile.roomToneFilterHz,
          now,
          0.4,
        );
      }
      if (this.roomToneGainNode) {
        this.roomToneGainNode.gain.cancelScheduledValues(now);
        this.roomToneGainNode.gain.setTargetAtTime(
          profile.roomToneGain,
          now,
          0.4,
        );
      }
      if (this.subDroneOsc) {
        this.subDroneOsc.frequency.cancelScheduledValues(now);
        this.subDroneOsc.frequency.setTargetAtTime(
          profile.baseDroneHz,
          now,
          0.5,
        );
      }
      if (this.fifthDroneOsc) {
        this.fifthDroneOsc.frequency.cancelScheduledValues(now);
        this.fifthDroneOsc.frequency.setTargetAtTime(
          profile.fifthDroneHz,
          now,
          0.5,
        );
      }

      if (prevRoom !== room) {
        this.noteStepIndex = 0;
        if (this.chimeTimerId !== null) {
          window.clearTimeout(this.chimeTimerId);
          this.chimeTimerId = null;
        }
        this.playGongResonance(profile.baseDroneHz * 2, 0.08, 2.8);
        this.scheduleNextGamelanNote();
      }
    }

    this.notifyState();
  }

  private startOrResume() {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    if (!this.initialized && this.ctx) {
      this.initialized = true;
      const profile = getRoomAudioProfile(this.currentRoom);
      const now = this.ctx.currentTime;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.001, now);
      this.masterGain.gain.setTargetAtTime(
        this.getEffectiveGain(),
        now,
        0.5,
      );
      this.masterGain.connect(this.ctx.destination);

      // 1. Subtle Museum Room Tone (Warm Low-Passed Brown/Pink Air Noise)
      const bufferSize = this.ctx.sampleRate * 3;
      const noiseBuffer = this.ctx.createBuffer(
        1,
        bufferSize,
        this.ctx.sampleRate,
      );
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 0.35;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      this.roomToneFilter = this.ctx.createBiquadFilter();
      this.roomToneFilter.type = 'lowpass';
      this.roomToneFilter.frequency.setValueAtTime(
        profile.roomToneFilterHz,
        now,
      );

      this.roomToneGainNode = this.ctx.createGain();
      this.roomToneGainNode.gain.setValueAtTime(profile.roomToneGain, now);

      whiteNoise.connect(this.roomToneFilter);
      this.roomToneFilter.connect(this.roomToneGainNode);
      this.roomToneGainNode.connect(this.masterGain);
      whiteNoise.start(now);

      // 2. Soft Sub-Harmonic Gong Ageng / Kenong Ambient Drone
      this.droneGainNode = this.ctx.createGain();
      this.droneGainNode.gain.setValueAtTime(0.022, now);
      this.droneGainNode.connect(this.masterGain);

      this.subDroneOsc = this.ctx.createOscillator();
      this.subDroneOsc.type = 'sine';
      this.subDroneOsc.frequency.setValueAtTime(profile.baseDroneHz, now);
      this.subDroneOsc.connect(this.droneGainNode);
      this.subDroneOsc.start(now);

      const fifthGain = this.ctx.createGain();
      fifthGain.gain.setValueAtTime(0.009, now);
      fifthGain.connect(this.masterGain);

      this.fifthDroneOsc = this.ctx.createOscillator();
      this.fifthDroneOsc.type = 'sine';
      this.fifthDroneOsc.frequency.setValueAtTime(profile.fifthDroneHz, now);
      this.fifthDroneOsc.connect(fifthGain);
      this.fifthDroneOsc.start(now);

      // 3. Start room-specific Gamelan melodic cycle
      this.scheduleNextGamelanNote();
      this.notifyState();
    }
  }

  private scheduleNextGamelanNote() {
    if (this.muted || !this.initialized || !this.ctx) return;
    if (this.chimeTimerId !== null) {
      window.clearTimeout(this.chimeTimerId);
    }

    const profile = getRoomAudioProfile(this.currentRoom);
    const patternIndices = [0, 2, 1, 3, 4, 2, 5, 3, 1, 4];
    const scaleIdx =
      patternIndices[this.noteStepIndex % patternIndices.length] %
      profile.scaleHz.length;
    const freq = profile.scaleHz[scaleIdx];

    this.playGamelanMetallophoneNote(
      freq,
      profile.bellAttackSec,
      profile.bellDecaySec,
      profile.overtoneRatio,
      0.042,
    );

    if (this.noteStepIndex % 4 === 0) {
      this.playGongResonance(profile.baseDroneHz * 2, 0.03, 3.2);
    }

    this.noteStepIndex++;
    const jitter = (this.noteStepIndex % 3) * 180;
    this.chimeTimerId = window.setTimeout(() => {
      this.scheduleNextGamelanNote();
    }, profile.tempoMs + jitter);
  }

  private playGamelanMetallophoneNote(
    freqHz: number,
    attackSec: number,
    decaySec: number,
    overtoneRatio: number,
    peakGain: number,
  ) {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freqHz, now);

    const oscOmbak = this.ctx.createOscillator();
    const gainOmbak = this.ctx.createGain();
    oscOmbak.type = 'sine';
    oscOmbak.frequency.setValueAtTime(freqHz + 1.6, now);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freqHz * overtoneRatio, now);

    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.linearRampToValueAtTime(peakGain, now + attackSec);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + decaySec);

    gainOmbak.gain.setValueAtTime(0.0001, now);
    gainOmbak.gain.linearRampToValueAtTime(
      peakGain * 0.45,
      now + attackSec * 1.2,
    );
    gainOmbak.gain.exponentialRampToValueAtTime(0.0001, now + decaySec * 0.85);

    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.linearRampToValueAtTime(peakGain * 0.22, now + 0.012);
    gain2.gain.exponentialRampToValueAtTime(
      0.0001,
      now + Math.min(0.7, decaySec * 0.3),
    );

    osc1.connect(gain1);
    oscOmbak.connect(gainOmbak);
    osc2.connect(gain2);

    gain1.connect(this.masterGain);
    gainOmbak.connect(this.masterGain);
    gain2.connect(this.masterGain);

    osc1.start(now);
    oscOmbak.start(now);
    osc2.start(now);

    const stopAt = now + decaySec + 0.1;
    osc1.stop(stopAt);
    oscOmbak.stop(stopAt);
    osc2.stop(stopAt);
  }

  private playGongResonance(freqHz: number, peakGain: number, decaySec: number) {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqHz, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decaySec);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + decaySec + 0.1);
  }

  public playInteractionChime(
    kind:
      | 'artwork'
      | 'cart'
      | 'portal'
      | 'click'
      | 'hover'
      | 'focus'
      | 'modalOpen'
      | 'modalClose'
      | 'success',
  ) {
    if (this.muted) return;
    if (!this.initialized) {
      this.startOrResume();
    }
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const profile = getRoomAudioProfile(this.currentRoom);
    const scale = profile.scaleHz;

    if (kind === 'click' || kind === 'hover') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const baseFreq = kind === 'click' ? 680 : 540;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.32, now + 0.042);

      const peak = kind === 'click' ? 0.045 : 0.02;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.08);
      return;
    }

    if (kind === 'focus') {
      // Smooth spatial camera-glide harmonic chime + soft low resonance
      const f1 = scale[1 % scale.length];
      const f2 = scale[3 % scale.length];
      this.playGamelanMetallophoneNote(f1, 0.018, 1.1, 2.4, 0.042);
      this.playGongResonance(profile.baseDroneHz * 1.5, 0.032, 0.9);
      window.setTimeout(() => {
        this.playGamelanMetallophoneNote(f2, 0.022, 1.4, 2.4, 0.048);
      }, 95);
      return;
    }

    if (kind === 'modalOpen') {
      const f1 = scale[0];
      const f2 = scale[2 % scale.length];
      this.playGamelanMetallophoneNote(f1, 0.012, 0.9, 2.4, 0.038);
      window.setTimeout(() => {
        this.playGamelanMetallophoneNote(f2, 0.015, 1.2, 2.4, 0.045);
      }, 65);
      return;
    }

    if (kind === 'modalClose') {
      const f1 = scale[2 % scale.length];
      const f2 = scale[0];
      this.playGamelanMetallophoneNote(f1, 0.012, 0.8, 2.4, 0.034);
      window.setTimeout(() => {
        this.playGamelanMetallophoneNote(f2, 0.015, 1.0, 2.4, 0.038);
      }, 60);
      return;
    }

    if (kind === 'artwork') {
      const f = scale[2 % scale.length];
      this.playGamelanMetallophoneNote(f, 0.015, 1.4, 2.4, 0.055);
    } else if (kind === 'cart' || kind === 'success') {
      const f1 = scale[1 % scale.length];
      const f2 = scale[4 % scale.length];
      this.playGamelanMetallophoneNote(f1, 0.015, 1.2, 2.4, 0.05);
      window.setTimeout(() => {
        this.playGamelanMetallophoneNote(f2, 0.015, 1.6, 2.4, 0.06);
      }, 110);
    } else if (kind === 'portal') {
      const f = scale[0];
      const fHigh = scale[3 % scale.length];
      this.playGamelanMetallophoneNote(f, 0.025, 2.0, 2.756, 0.05);
      this.playGongResonance(profile.baseDroneHz, 0.045, 1.8);
      window.setTimeout(() => {
        this.playGamelanMetallophoneNote(fHigh, 0.02, 1.7, 2.4, 0.045);
      }, 120);
    }
  }

  private notifyState() {
    if (this.onStateChange) {
      this.onStateChange(this.isPlaying(), this.getCurrentProfile());
    }
  }

  public dispose() {
    if (this.chimeTimerId !== null) {
      window.clearTimeout(this.chimeTimerId);
      this.chimeTimerId = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
