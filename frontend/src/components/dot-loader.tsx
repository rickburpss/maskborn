"use client";

import { motion, useReducedMotion } from "motion/react";

export function DotLoader({
  label = "Loading artwork",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={`dot-loader ${compact ? "compact" : ""}`} role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <motion.span
            key={index}
            initial={false}
            animate={reduceMotion
              ? { opacity: 1 }
              : { y: [0, -7, 0], opacity: [0.3, 1, 0.3], scale: [0.8, 1.15, 0.8] }}
            transition={{
              duration: 0.85,
              delay: index * 0.12,
              repeat: reduceMotion ? 0 : Infinity,
              ease: "easeInOut",
            }}
          >
            .
          </motion.span>
        ))}
      </div>
    </div>
  );
}
