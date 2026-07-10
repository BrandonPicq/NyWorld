import { forwardRef, type ComponentPropsWithoutRef } from "react";

type EditorButtonProps = ComponentPropsWithoutRef<"button"> & {
  isSelected?: boolean;
};

/** A compact editor-only command button, isolated from the game terminal UI. */
export const EditorButton = forwardRef<HTMLButtonElement, EditorButtonProps>(
  function EditorButton(
    { className, isSelected = false, type = "button", ...buttonProps },
    ref,
  ) {
    const classes = ["editor-button", className].filter(Boolean).join(" ");

    return (
      <button
        aria-current={isSelected ? "true" : undefined}
        className={classes}
        data-selected={isSelected ? "true" : undefined}
        ref={ref}
        type={type}
        {...buttonProps}
      />
    );
  },
);
