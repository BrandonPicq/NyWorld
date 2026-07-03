type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

type MenuToneOptions = {
  durationSeconds: number;
  frequency: number;
  gain: number;
};

let audioContext: AudioContext | undefined;

export function playMenuMoveSound() {
  playMenuTone({
    durationSeconds: 0.035,
    frequency: 660,
    gain: 0.018,
  });
}

export function playMenuConfirmSound() {
  playMenuTone({
    durationSeconds: 0.055,
    frequency: 880,
    gain: 0.025,
  });
}

export function playTextBleepSound(pitchFactor: number) {
  const baseFreq = 160;
  playMenuTone({
    durationSeconds: 0.025,
    frequency: baseFreq * pitchFactor,
    gain: 0.015,
  });
}

export function playItemCollectSound() {
  playMenuToneSequence([
    { frequency: 520, durationSeconds: 0.045, gain: 0.02 },
    { frequency: 780, durationSeconds: 0.06, gain: 0.02 },
  ]);
}

function playMenuTone({ durationSeconds, frequency, gain }: MenuToneOptions) {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  const play = () => {
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    const now = context.currentTime;

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(frequency, now);
    volume.gain.setValueAtTime(gain, now);
    volume.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + durationSeconds);
  };

  if (context.state === "suspended") {
    void context.resume().then(play).catch(() => undefined);
    return;
  }

  play();
}

function playMenuToneSequence(steps: MenuToneOptions[]) {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  const play = () => {
    const baseTime = context.currentTime;
    let cursor = 0;

    for (const step of steps) {
      const start = baseTime + cursor;
      const end = start + step.durationSeconds;

      const oscillator = context.createOscillator();
      const volume = context.createGain();

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(step.frequency, start);
      volume.gain.setValueAtTime(step.gain, start);
      volume.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(volume);
      volume.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end);

      cursor += step.durationSeconds;
    }
  };

  if (context.state === "suspended") {
    void context.resume().then(play).catch(() => undefined);
    return;
  }

  play();
}

function getAudioContext() {
  if (typeof window === "undefined") {
    return undefined;
  }

  if (audioContext) {
    return audioContext;
  }

  const audioWindow = window as AudioWindow;
  const AudioContextConstructor =
    audioWindow.AudioContext ?? audioWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    return undefined;
  }

  audioContext = new AudioContextConstructor();
  return audioContext;
}

export function playQteKeySound(direction: "up" | "down" | "left" | "right") {
  const frequencies = {
    up: 600,
    down: 400,
    left: 480,
    right: 520,
  };
  playMenuTone({
    durationSeconds: 0.06,
    frequency: frequencies[direction],
    gain: 0.025,
  });
}

export function playQteErrorSound() {
  playMenuTone({
    durationSeconds: 0.18,
    frequency: 110,
    gain: 0.04,
  });
}
