import { forwardRef, type ComponentPropsWithoutRef } from "react";

type TerminalButtonProps = ComponentPropsWithoutRef<"button"> & {
  isSelected?: boolean;
};

export const TerminalButton = forwardRef<HTMLButtonElement, TerminalButtonProps>(
  function TerminalButton(
    { className, isSelected = false, type = "button", ...buttonProps },
    ref,
  ) {
    const classes = ["terminal-button", className].filter(Boolean).join(" ");

    return (
      <button
        aria-current={isSelected ? "true" : undefined}
        className={classes}
        data-keyboard-blocking-hover="true"
        data-selected={isSelected ? "true" : undefined}
        ref={ref}
        type={type}
        {...buttonProps}
      />
    );
  },
);
