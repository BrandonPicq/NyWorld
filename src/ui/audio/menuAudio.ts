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
