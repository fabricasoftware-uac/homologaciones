// Posiciones válidas para las notificaciones (sileo). Se usan en el panel (selector) y en la
// validación de la server action que guarda la configuración.
export const POSICIONES_NOTIF = [
  { clave: "top-center", nombre: "Arriba centro" },
  { clave: "top-right", nombre: "Arriba derecha" },
  { clave: "top-left", nombre: "Arriba izquierda" },
  { clave: "bottom-center", nombre: "Abajo centro" },
  { clave: "bottom-right", nombre: "Abajo derecha" },
  { clave: "bottom-left", nombre: "Abajo izquierda" },
] as const;

export const CLAVES_POSICION: string[] = POSICIONES_NOTIF.map((p) => p.clave);
