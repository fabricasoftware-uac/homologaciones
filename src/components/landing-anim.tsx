"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";

// Revela su contenido al entrar en viewport (fade + subida). Para el efecto "se va armando al hacer
// scroll" de la landing. Respeta prefers-reduced-motion (Framer lo maneja con el flag global).
export function Revelar({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Contador que cuenta desde 0 hasta `valor` cuando entra en viewport (easeOutCubic). Sin librerías:
// requestAnimationFrame + useInView.
export function Contador({
  valor,
  sufijo = "",
  duracion = 1.3,
}: {
  valor: number;
  sufijo?: string;
  duracion?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const enVista = useInView(ref, { once: true, margin: "-40px" });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!enVista) return;
    let raf = 0;
    const inicio = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - inicio) / (duracion * 1000), 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(valor * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enVista, valor, duracion]);

  return (
    <span ref={ref}>
      {n}
      {sufijo}
    </span>
  );
}
