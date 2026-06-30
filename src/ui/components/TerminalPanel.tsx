import type { ComponentPropsWithoutRef } from "react";

type TerminalPanelProps = ComponentPropsWithoutRef<"section">;

export function TerminalPanel({
  className,
  ...sectionProps
}: TerminalPanelProps) {
  const classes = ["terminal-panel", className].filter(Boolean).join(" ");

  return <section className={classes} {...sectionProps} />;
}
