"use client";

import { motion } from "motion/react";

// template.tsx (a diferencia de layout.tsx) se vuelve a montar en CADA navegación, así que es el
// lugar para animar la entrada de cada página: una aparición sutil con un leve desplazamiento. Da
// esa sensación de transición al moverse entre apartados, sin recargar nada.
export default function TransicionPagina({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
