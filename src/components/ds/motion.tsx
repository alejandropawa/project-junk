"use client";

import { motion, useReducedMotion } from "framer-motion";

type MotionFadeInProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

/** Subtle entrance - respects prefers-reduced-motion */
export function MotionFadeIn({ children, className, delay = 0 }: MotionFadeInProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, delay, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

type MotionFadeUpProps = {
  children: React.ReactNode;
  className?: string;
};

export function MotionFadeUp({ children, className }: MotionFadeUpProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-48px" }}
      transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
