import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number from 0 to `target` over `duration` ms.
 * Returns the current animated value.
 */
export function useCountUp(target: number, duration = 600): number {
  const [current, setCurrent] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    // Don't animate on first render if target is 0
    if (target === 0 && prevTarget.current === 0) {
      setCurrent(0);
      return;
    }

    const start = prevTarget.current;
    const diff = target - start;
    const startTime = performance.now();

    let raf: number;
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(start + diff * eased));

      if (progress < 1) {
        raf = requestAnimationFrame(step);
      }
    };

    raf = requestAnimationFrame(step);
    prevTarget.current = target;

    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return current;
}
