"use client";

import { Toaster } from "sileo";

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
export function Notificaciones({ posicion = "top-center" }: { posicion?: string }) {
  return <Toaster position={posicion as Posicion} theme="light" />;
}
