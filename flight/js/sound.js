export class Synth {
  constructor(enabled) {
    this.enabled = enabled;
    this.ctx = null;
    this.lastShot = -1;
  }

  unlock() {
    if (!this.enabled) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!this.ctx) this.ctx = new Audio();
      if (this.ctx.state === 'suspended') this.ctx.resume().catch (() => {});
    } catch { /* The game can run silently on devices that disallow audio. */ }
  }

  tone(from, to, length, volume, wave = 'sine', delay = 0) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx, start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator(), envelope = ctx.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + length);
    envelope.gain.setValueAtTime(.001, start);
    envelope.gain.exponentialRampToValueAtTime(volume, start + .009);
    envelope.gain.exponentialRampToValueAtTime(.001, start + length);
    oscillator.connect(envelope);
    envelope.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + length + .01);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }

  play(name) {
    if (!this.enabled || !this.ctx) return;
    switch (name) {
      case 'shoot':
      if (this.ctx.currentTime - this.lastShot < .12) break;
      this.lastShot = this.ctx.currentTime;
      this.tone(465, 145, .075, .031, 'triangle');
      break;
      case 'kill':
      this.tone(142, 32, .20, .09, 'sawtooth');
      break;
      case 'hit':
      this.tone(108, 46, .22, .12, 'triangle');
      break;
      case 'pulse':
      this.tone(290, 40, .54, .12, 'sawtooth');
      break;
      case 'launch': case 'win':
      this.tone(261, 392, .19, .08);
      this.tone(392, 523, .23, .07, 'triangle', .15);
      this.tone(523, 784, .32, .07, 'triangle', .32);
      break;
      case 'repair':
      this.tone(620, 950, .18, .08);
      break;
      case 'boss': case 'loss':
      this.tone(185, 82, .5, .09, 'triangle');
      break;
      case 'select':
      this.tone(420, 600, .08, .046);
      break;
    }
  }
}
