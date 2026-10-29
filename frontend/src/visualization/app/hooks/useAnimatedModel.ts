import { useEffect, useRef, useState } from "react";
import { interpolateModel } from "../rent";
import type { ModelConfig } from "../types";

export function useAnimatedModel(target: ModelConfig): ModelConfig {
  const [displayed, setDisplayed] = useState<ModelConfig>(target);
  const displayedRef = useRef(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!target.animation || reduceMotion) {
      displayedRef.current = target;
      setDisplayed(target);
      return;
    }

    const startModel = displayedRef.current;
    const startedAt = performance.now();
    const duration = 230;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = interpolateModel(startModel, target, eased);
      displayedRef.current = next;
      setDisplayed(next);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        displayedRef.current = target;
        setDisplayed(target);
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [target]);

  return displayed;
}
