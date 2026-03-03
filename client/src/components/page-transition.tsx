import { motion } from "framer-motion";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PageTransition({
  children,
  className,
  key: animationKey,
}: {
  children: React.ReactNode;
  className?: string;
  key: string;
}) {
  const reduced = prefersReducedMotion();
  return (
    <motion.div
      key={animationKey}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.22, ease: [0.33, 1, 0.68, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
