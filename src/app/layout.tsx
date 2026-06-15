import type { Metadata } from "next";
import "@/styles/index.css";

// Layout raíz: solo el cascarón <html>/<body> y los estilos globales. El sidebar y el marco de
// la app viven ahora en el grupo (app), para que pantallas sin sesión —como /ingresar— no lo
// hereden. lang="es" porque toda la interfaz está en español.
export const metadata: Metadata = {
  title: "TransfoEdu · Homologaciones",
  description:
    "Compara el certificado de notas de un estudiante de otra universidad contra el pensum de la Autónoma del Cauca y sugiere en qué semestre podría ubicarse.",
  robots: "noindex, nofollow",
};

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
