let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

/** ピロリン♪ 覚えたSE */
export function playPirorin() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const notes = [880, 1108.73, 1318.51]; // A5, C#6, E6
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, now + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.3);
  });
}

/** ポンッ 微妙SE */
export function playPon() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(660, now);
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

/** ドゴッ！ 打撃音（バトル攻撃ヒット用）
 *  低音の衝撃 + 短いノイズバーストで「殴った／ぶつかった」感を出す */
export function playHit() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // 低音のドゥッ（重み）
  const lowOsc = ctx.createOscillator();
  const lowGain = ctx.createGain();
  lowOsc.type = 'sine';
  lowOsc.frequency.setValueAtTime(140, now);
  lowOsc.frequency.exponentialRampToValueAtTime(45, now + 0.09);
  lowGain.gain.setValueAtTime(0.001, now);
  lowGain.gain.exponentialRampToValueAtTime(0.45, now + 0.005);
  lowGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
  lowOsc.connect(lowGain);
  lowGain.connect(ctx.destination);
  lowOsc.start(now);
  lowOsc.stop(now + 0.15);

  // 高音のパッ（衝撃の鋭さ）
  const noiseDur = 0.06;
  const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * noiseDur), ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / data.length * 6);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1800;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.18, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDur);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + noiseDur);

  // 中音のドン（実体感）
  const midOsc = ctx.createOscillator();
  const midGain = ctx.createGain();
  midOsc.type = 'square';
  midOsc.frequency.setValueAtTime(280, now);
  midOsc.frequency.exponentialRampToValueAtTime(110, now + 0.07);
  midGain.gain.setValueAtTime(0.001, now);
  midGain.gain.exponentialRampToValueAtTime(0.18, now + 0.005);
  midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  midOsc.connect(midGain);
  midGain.connect(ctx.destination);
  midOsc.start(now);
  midOsc.stop(now + 0.12);
}

/** ファンファーレ♪ レベルアップ時の祝福SE（4音の上昇トランペット風） */
export function playFanfare() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // C5(523) → E5(659) → G5(784) → C6(1047)
  const notes = [523.25, 659.25, 783.99, 1046.50];
  const noteDuration = 0.18;
  const finalSustain = 0.5;

  notes.forEach((freq, i) => {
    const isLast = i === notes.length - 1;
    const startTime = now + i * noteDuration * 0.6;
    const dur = isLast ? finalSustain : noteDuration;

    // ブラス感を出すために triangle + 軽い倍音
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(isLast ? 0.28 : 0.22, startTime + 0.02);
    gain.gain.setValueAtTime(isLast ? 0.28 : 0.22, startTime + dur * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.05);

    // 倍音（オクターブ上のサイン波で輝きを足す）
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;
    gain2.gain.setValueAtTime(0.001, startTime);
    gain2.gain.exponentialRampToValueAtTime(0.07, startTime + 0.03);
    gain2.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(startTime);
    osc2.stop(startTime + dur + 0.05);
  });
}

/** ぽにょん♪ エサを食べた感じのSE */
export function playMunch() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // ぽにょんとした弾むような音：周波数を高→低へグライド + ビブラート
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(740, now);
  osc.frequency.exponentialRampToValueAtTime(280, now + 0.18);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.25);

  // モグっとした倍音を少し重ねて食感を出す
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(1480, now + 0.01);
  osc2.frequency.exponentialRampToValueAtTime(560, now + 0.15);
  gain2.gain.setValueAtTime(0.001, now);
  gain2.gain.exponentialRampToValueAtTime(0.08, now + 0.03);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now);
  osc2.stop(now + 0.2);
}

/** ひらがな読み上げ（Web Speech API） */
export function speakJa(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!text) return;
  // 連続タップなどで重ならないよう既存発話をキャンセル
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = 0.9;
  u.pitch = 1.1;
  window.speechSynthesis.speak(u);
}

/** ブブー 不正解SE */
export function playBuzzer() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // 低い矩形波2音で「ブブー」
  for (let i = 0; i < 2; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 150;
    gain.gain.setValueAtTime(0.12, now + i * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.18);
    osc.stop(now + i * 0.18 + 0.15);
  }
}
