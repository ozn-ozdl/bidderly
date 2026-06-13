"use client";

import { useLayoutEffect, useRef, useState } from "react";

type CountUpProps = {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
};

export function CountUp({ value, duration = 700, className, prefix = "", suffix = "", decimals = 0 }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const lastValueRef = useRef(value);

  useLayoutEffect(() => {
    if (lastValueRef.current === value) return;
    lastValueRef.current = value;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      fromRef.current = value;
      const r = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(r);
    }

    fromRef.current = display;
    startRef.current = null;

    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = fromRef.current + (value - fromRef.current) * eased;
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(value);
        fromRef.current = value;
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, display]);

  const formatted = display.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
