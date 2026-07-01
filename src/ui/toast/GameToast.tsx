import { useEffect, useState } from "react";

type GameToastProps = {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
};

export function GameToast({
  message,
  onDismiss,
  durationMs = 2500,
}: GameToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, durationMs);

    return () => clearTimeout(timer);
  }, [durationMs, onDismiss]);

  return (
    <div
      className="game-toast"
      data-visible={visible ? "true" : undefined}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
