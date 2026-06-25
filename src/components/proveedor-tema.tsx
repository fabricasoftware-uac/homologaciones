"use client";

import { ThemeProvider } from "next-themes";

// Proveedor de tema (claro/oscuro). Envuelve la app en el layout raíz. Usa la clase `dark` en <html>
// (attribute="class"). Arranca SIEMPRE en CLARO por defecto (no sigue al sistema): el modo oscuro se
// activa a mano y la elección se recuerda en localStorage. disableTransitionOnChange evita el "flash"
// de transición global al cambiar (la animación bonita la hace el botón con View Transitions).
export function ProveedorTema({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
