"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sileo";
import { useTheme } from "next-themes";

// Posiciones que admite sileo. Las recibimos como string desde la config y las acotamos aquí.
type Posicion =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

// Contenedor global de notificaciones (sileo). Se monta UNA sola vez en el layout raíz; la posición
// viene de la configuración de la institución. El color se aplica vía variables CSS que el layout
// raíz fija en <body> (--sileo-state-success / --sileo-state-info).
//
// OJO con la semántica de sileo 0.1.5: el nombre del theme está INVERTIDO respecto al relleno de la
// píldora — theme="dark" pinta la píldora CLARA (#f2f2f2, texto oscuro) y theme="light" la OSCURA
// (#1a1a1a, texto claro). Antes iba fijo en "light": en modo claro salía una píldora negra con el
// título en el color de la marca (azul oscuro) encima — ilegible. Ahora la píldora SIGUE el tema de
// la app: app clara → píldora clara; app oscura → píldora oscura.
export function Notificaciones({ posicion = "top-center" }: { posicion?: string }) {
  const { resolvedTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const pildoraOscura = montado && resolvedTheme === "dark";
  return <Toaster position={posicion as Posicion} theme={pildoraOscura ? "light" : "dark"} />;
}
