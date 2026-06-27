/**
 * Synthesizes a pleasant high-tech chirp/beep to confirm audio activation
 */
export function playTestSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Chirp: quickly sweeps from 600Hz to 1200Hz
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch (err) {
    console.warn("Could not play test sound:", err);
  }
}

export function playAlertSound() {
  if (typeof window === 'undefined') return;

  const audio = new Audio('/alert.mp3');
  audio.volume = 0.4;

  audio.play()
    .catch((err) => {
      // Failed to play alert.mp3 (likely because it's not present or autoplay blocked)
      // Fallback to synthesizing a futuristic warning sound using Web Audio API
      playSynthWarning();
    });
}

export function playFaahSound() {
  if (typeof window === 'undefined') return;

  const audioFaah = new Audio('/faaah.mp3');
  audioFaah.volume = 0.3;

  audioFaah.play()
    .catch((err) => {
      playSynthWarning();
    });
}

function playSynthWarning() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // We'll create a dual-tone discordant alarm sound that repeats twice (chirp chirp)
    const playPulse = (startTime: number) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sine';

      // Futuristic warning alarm frequencies (e.g., A5 880Hz and discordant G#5 830Hz)
      osc1.frequency.setValueAtTime(880, startTime);
      osc1.frequency.linearRampToValueAtTime(440, startTime + 0.25);

      osc2.frequency.setValueAtTime(830, startTime);
      osc2.frequency.linearRampToValueAtTime(415, startTime + 0.25);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(startTime);
      osc2.start(startTime);

      osc1.stop(startTime + 0.26);
      osc2.stop(startTime + 0.26);
    };

    // Play a double alarm beep
    playPulse(ctx.currentTime);
    playPulse(ctx.currentTime + 0.32);
  } catch (err) {
    console.warn("Could not play synth warning sound:", err);
  }
}
