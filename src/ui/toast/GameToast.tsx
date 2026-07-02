import { useEffect, useState } from "react";

export type GameToastTone = "default" | "important";

type GameToastProps = {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
  tone?: GameToastTone;
};

export function GameToast({
  message,
  onDismiss,
  durationMs = 2500,
  tone = "default",
}: GameToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const showFrame = requestAnimationFrame(() => setVisible(true));
    let dismissTimer: number | undefined;

    const timer = window.setTimeout(() => {
      setVisible(false);
      dismissTimer = window.setTimeout(onDismiss, 300);
    }, durationMs);

    return () => {
      cancelAnimationFrame(showFrame);
      clearTimeout(timer);
      if (dismissTimer !== undefined) {
        clearTimeout(dismissTimer);
      }
    };
  }, [durationMs, message, onDismiss, tone]);

  return (
    <div
      className="game-toast"
      data-tone={tone}
      data-visible={visible ? "true" : undefined}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
