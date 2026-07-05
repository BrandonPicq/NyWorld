import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";

type ScrollRegionProps = ComponentPropsWithoutRef<"div">;

interface ScrollMetrics {
  canScroll: boolean;
  thumbHeight: number;
  thumbTop: number;
}

const EMPTY_METRICS: ScrollMetrics = {
  canScroll: false,
  thumbHeight: 0,
  thumbTop: 0,
};

/**
 * A block that fills its flex parent and scrolls on its own.
 *
 * Screens are composed as an assortment of independent scroll regions so the
 * page itself never scrolls as one tall block. Pair with `app-shell--bounded`
 * on the screen root and give each scrolling area its own ScrollRegion.
 */
export function ScrollRegion({
  children,
  className,
  onScroll,
  ...props
}: ScrollRegionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<ScrollMetrics>(EMPTY_METRICS);
  const classes = ["scroll-region", className].filter(Boolean).join(" ");

  const updateMetrics = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const maxScrollTop = element.scrollHeight - element.clientHeight;
    if (maxScrollTop <= 1) {
      setMetrics((current) =>
        current.canScroll ? EMPTY_METRICS : current,
      );
      return;
    }

    const thumbHeight = Math.max(
      18,
      Math.round(
        (element.clientHeight / element.scrollHeight) * element.clientHeight,
      ),
    );
    const maxThumbTop = Math.max(0, element.clientHeight - thumbHeight);
    const thumbTop = Math.round(
      (element.scrollTop / maxScrollTop) * maxThumbTop,
    );

    setMetrics((current) =>
      current.canScroll &&
      current.thumbHeight === thumbHeight &&
      current.thumbTop === thumbTop
        ? current
        : { canScroll: true, thumbHeight, thumbTop },
    );
  }, []);

  useLayoutEffect(() => {
    updateMetrics();
  });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(updateMetrics);
    observer.observe(element);
    for (const child of Array.from(element.children)) {
      observer.observe(child);
    }

    window.addEventListener("resize", updateMetrics);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateMetrics);
    };
  }, [children, updateMetrics]);

  return (
    <div
      className="scroll-region-frame"
      data-scrollable={metrics.canScroll ? "true" : undefined}
    >
      <div
        className={classes}
        onScroll={(event) => {
          onScroll?.(event);
          updateMetrics();
        }}
        ref={scrollRef}
        {...props}
      >
        {children}
      </div>
      {metrics.canScroll ? (
        <div aria-hidden="true" className="scroll-region__indicator">
          <span
            className="scroll-region__thumb"
            style={{
              height: `${metrics.thumbHeight}px`,
              transform: `translateY(${metrics.thumbTop}px)`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
