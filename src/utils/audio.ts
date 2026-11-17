// Pure Web Audio API Synthesizer (Zero external assets/libraries)

let audioCtx: AudioContext | null = null;
let lastThudTime = 0;

export function ensureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * 맑고 부드러운 상승 2음 차임
 * (sine, 약 660Hz → 880Hz, 총 300~400ms, 볼륨 작게, 부드러운 페이드아웃)
 * 완료 버튼이 눌릴 때, 그리고 칸이 모두 채워져 완료 상태가 되는 순간 재생
 */
export function playCompletionChime() {
  try {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';

    // 660Hz (첫 음, 140ms) -> 880Hz (둘째 음, 200ms)
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(660, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);

    // 볼륨 작고 부드럽게 (최대 0.12 -> 0으로 부드러운 페이드아웃)
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
    gain.gain.setValueAtTime(0.12, now + 0.14);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.39);
  } catch {
    // Ignore audio error
  }
}

/**
 * 낮고 짧은 "툭" 소리
 * (sine, 약 180Hz → 120Hz, 100~150ms, 볼륨 작게)
 * 칸이 다 찼는데 더 늘리려고 드래그할 때 재생.
 * 같은 드래그 동안 연타 방지를 위해 최소 250ms 간격으로만 재생.
 */
export function playLimitThud() {
  const nowMs = performance.now();
  if (nowMs - lastThudTime < 250) return;
  lastThudTime = nowMs;

  try {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);

    // 볼륨 작게 (0.1 -> 0 페이드아웃)
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.14);
  } catch {
    // Ignore audio error
  }
}
