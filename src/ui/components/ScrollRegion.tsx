import type { ComponentPropsWithoutRef } from "react";

type ScrollRegionProps = ComponentPropsWithoutRef<"div">;

/**
 * A block that fills its flex parent and scrolls on its own.
 *
 * Screens are composed as an assortment of independent scroll regions so the
 * page itself never scrolls as one tall block. Pair with `app-shell--bounded`
 * on the screen root and give each scrolling area its own ScrollRegion.
 */
export function ScrollRegion({ className, ...props }: ScrollRegionProps) {
  const classes = ["scroll-region", className].filter(Boolean).join(" ");
  return <div className={classes} {...props} />;
}
