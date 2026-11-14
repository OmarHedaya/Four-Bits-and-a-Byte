/**
 * Emergency Siren Audio Controller (Web Audio API)
 * ================================================
 * Generates an unmistakable dual-oscillator emergency warning siren
 * triggered within user interaction handlers (respecting browser autoplay policies)
 * with immediate Mute/Stop and Acknowledge controls and bounded duration.
 */

class EmergencyAlarmController {
  private ctx: AudioContext | null = null;
  private oscPrimary: OscillatorNode | null = null;
  private oscSecondary: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private sweepInterval: ReturnType<typeof setInterval> | null = null;
  private autoStopTimeout: ReturnType<typeof setTimeout> | null = null;
  private playing = false;
  private muted = false;

  public isPlaying(): boolean {
    return this.playing;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public startAlarm(): void {
    this.stopAlarm();
    this.playing = true;
    this.muted = false;

    try {
      const AudioCtx =
        typeof window !== 'undefined'
          ? window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext
          : undefined;

      if (AudioCtx) {
        this.ctx = new AudioCtx();
        if (this.ctx.state === 'suspended') {
          void this.ctx.resume().catch(() => {});
        }

        const now = this.ctx.currentTime;
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.setValueAtTime(0.26, now);
        this.gainNode.connect(this.ctx.destination);

        this.oscPrimary = this.ctx.createOscillator();
        this.oscSecondary = this.ctx.createOscillator();
        this.oscPrimary.type = 'sawtooth';
        this.oscSecondary.type = 'triangle';

        this.oscPrimary.frequency.setValueAtTime(680, now);
        this.oscSecondary.frequency.setValueAtTime(1020, now);

        this.oscPrimary.connect(this.gainNode);
        this.oscSecondary.connect(this.gainNode);

        this.oscPrimary.start(now);
        this.oscSecondary.start(now);

        let highPhase = false;
        this.sweepInterval = setInterval(() => {
          if (!this.ctx || !this.oscPrimary || !this.oscSecondary || this.muted) {
            return;
          }
          highPhase = !highPhase;
          const t = this.ctx.currentTime;
          this.oscPrimary.frequency.exponentialRampToValueAtTime(
            highPhase ? 1160 : 680,
            t + 0.35,
          );
          this.oscSecondary.frequency.exponentialRampToValueAtTime(
            highPhase ? 1480 : 920,
            t + 0.35,
          );
        }, 420);
      }
    } catch {
      // Safe fallback in headless/test or restricted audio environments
    }

    // Bounded duration (stops after 12 seconds to prevent infinite unattended repetition)
    this.autoStopTimeout = setTimeout(() => {
      this.stopSoundOnly();
    }, 12_000);
  }

  public stopSoundOnly(): void {
    this.muted = true;
    this.playing = false;
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
    if (this.autoStopTimeout) {
      clearTimeout(this.autoStopTimeout);
      this.autoStopTimeout = null;
    }
    try {
      if (this.oscPrimary) {
        this.oscPrimary.stop();
        this.oscPrimary.disconnect();
        this.oscPrimary = null;
      }
      if (this.oscSecondary) {
        this.oscSecondary.stop();
        this.oscSecondary.disconnect();
        this.oscSecondary = null;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      if (this.ctx) {
        void this.ctx.close().catch(() => {});
        this.ctx = null;
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  public stopAlarm(): void {
    this.stopSoundOnly();
    this.muted = false;
  }
}

export const emergencyAlarm = new EmergencyAlarmController();
