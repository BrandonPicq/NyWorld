import type { ComponentPropsWithoutRef } from "react";

type EditorPanelProps = ComponentPropsWithoutRef<"section">;

/** A semantic editor region that preserves the keyboard-navigation class. */
export function EditorPanel({
  className,
  ...sectionProps
}: EditorPanelProps) {
  const classes = ["editor-panel", className].filter(Boolean).join(" ");

  return <section className={classes} {...sectionProps} />;
}
