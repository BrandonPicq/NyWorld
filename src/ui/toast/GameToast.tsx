import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
} from "react";

export type GameToastTone = "default" | "important";

export type GameToastEntry = {
  id: number;
  message: string;
  tone: GameToastTone;
};

type GameToastStackProps = {
  durationMs?: number;
  onDismiss: (id: number) => void;
  toasts: GameToastEntry[];
};

type GameToastProps = GameToastEntry & {
  durationMs: number;
  isPaused: boolean;
  onDismiss: (id: number) => void;
};

export function GameToastStack({
  durationMs = 3200,
  onDismiss,
  toasts,
}: GameToastStackProps) {
  const [hasFocusInside, setHasFocusInside] = useState(false);
  const [hasPointerInside, setHasPointerInside] = useState(false);
  const isPaused = hasFocusInside || hasPointerInside;

  if (toasts.length === 0) {
    return null;
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setHasFocusInside(false);
    }
  }

  return (
    <div
      className="game-toast-stack"
      onBlur={handleBlur}
      onFocus={() => setHasFocusInside(true)}
      onPointerEnter={() => setHasPointerInside(true)}
      onPointerLeave={() => setHasPointerInside(false)}
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <GameToast
          durationMs={durationMs}
          id={toast.id}
          isPaused={isPaused}
          key={toast.id}
          message={toast.message}
          onDismiss={onDismiss}
          tone={toast.tone}
        />
      ))}
    </div>
  );
}

function GameToast({
  id,
  isPaused,
  message,
  onDismiss,
  durationMs,
  tone = "default",
}: GameToastProps) {
  const [visible, setVisible] = useState(false);
  const dismissTimerRef = useRef<number | undefined>(undefined);
  const exitTimerRef = useRef<number | undefined>(undefined);
  const onDismissRef = useRef(onDismiss);
  const remainingMsRef = useRef(durationMs);
  const timerStartedAtRef = useRef(0);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const clearTimers = useCallback(() => {
    if (dismissTimerRef.current !== undefined) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = undefined;
    }

    if (exitTimerRef.current !== undefined) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = undefined;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimers();
    setVisible(false);
    exitTimerRef.current = window.setTimeout(() => {
      onDismissRef.current(id);
    }, 300);
  }, [clearTimers, id]);

  useEffect(() => {
    setVisible(false);
    remainingMsRef.current = durationMs;
    const showFrame = requestAnimationFrame(() => setVisible(true));

    return () => {
      cancelAnimationFrame(showFrame);
      clearTimers();
    };
  }, [clearTimers, durationMs, id]);

  useEffect(() => {
    if (!visible || isPaused) {
      return;
    }

    timerStartedAtRef.current = Date.now();
    dismissTimerRef.current = window.setTimeout(dismiss, remainingMsRef.current);

    return () => {
      if (dismissTimerRef.current !== undefined) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = undefined;
      }

      const elapsedMs = Date.now() - timerStartedAtRef.current;
      remainingMsRef.current = Math.max(0, remainingMsRef.current - elapsedMs);
    };
  }, [dismiss, isPaused, visible]);

  return (
    <div
      className="game-toast"
      data-tone={tone}
      data-visible={visible ? "true" : undefined}
      tabIndex={0}
    >
      {message}
    </div>
  );
}
