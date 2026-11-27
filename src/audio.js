let context;
let muted = false;
const active = new Set();

export function enableAfterGesture() {
  if (muted) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    context ??= new Audio();
    if (context.state === 'suspended') context.resume().catch(() => {});
  } catch { /* 音频不可用也可以继续玩。 */ }
}

export function setMuted(value) {
  muted = value;
  if (value) for (const oscillator of active) { try { oscillator.stop(); } catch {} }
}

export function playEffect(name = 'click') {
  if (muted || !context || context.state !== 'running') return;
  const tunes = { click: [540, 760], move: [430, 660], error: [380, 250, 170], success: [523, 659, 784, 1047], prank: [640, 520, 760, 330] };
  try {
    (tunes[name] ?? tunes.click).forEach((frequency, i) => {
      const start = context.currentTime + i * 0.075;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = name === 'error' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.8, start + 0.12);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.045, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
      oscillator.connect(gain); gain.connect(context.destination);
      active.add(oscillator);
      oscillator.onended = () => { active.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start); oscillator.stop(start + 0.17);
    });
  } catch { /* 静音回退。 */ }
}
