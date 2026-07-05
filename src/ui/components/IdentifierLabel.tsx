import { Fragment } from "react";

export interface IdentifierLabelPart {
  text: string;
  breakAfter: boolean;
}

type IdentifierLabelProps = {
  value: string;
  className?: string;
};

const IDENTIFIER_BREAK_PATTERN = /[._:-]+/g;

/**
 * Splits a technical id into visible chunks with safe breakpoints after common
 * id separators. The separator stays attached to the preceding chunk, so a line
 * can wrap as `advanced_` / `quest_complete` instead of `advanced_qu` / `est`.
 */
export function splitIdentifierLabel(value: string): IdentifierLabelPart[] {
  const parts: IdentifierLabelPart[] = [];
  let start = 0;

  for (const match of value.matchAll(IDENTIFIER_BREAK_PATTERN)) {
    const index = match.index;
    if (index === undefined) {
      continue;
    }

    const end = index + match[0].length;
    parts.push({ text: value.slice(start, end), breakAfter: true });
    start = end;
  }

  if (start < value.length || parts.length === 0) {
    parts.push({ text: value.slice(start), breakAfter: false });
  }

  return parts;
}

export function IdentifierLabel({ className, value }: IdentifierLabelProps) {
  const classes = ["identifier-label", className].filter(Boolean).join(" ");

  return (
    <span className={classes}>
      {splitIdentifierLabel(value).map((part, index) => (
        <Fragment key={`${part.text}-${index}`}>
          {part.text}
          {part.breakAfter ? <wbr /> : null}
        </Fragment>
      ))}
    </span>
  );
}
