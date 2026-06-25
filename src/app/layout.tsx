import type { Metadata } from "next";
import "@/styles/index.css";
import "sileo/styles.css";
import "@/styles/sileo-tema.css";

import { Notificaciones } from "@/components/notificaciones";
import { ProveedorTema } from "@/components/proveedor-tema";
import { obtenerConfiguracion, variablesDeMarca } from "@/lib/marca/configuracion";
import { cssTemaOscuro } from "@/lib/marca/temas-oscuros";

// Layout raíz: el cascarón <html>/<body>, los estilos globales y los TOKENS DE MARCA. Lee la
// configuración de la institución (nombre y colores) y la inyecta como variables CSS en <body>, para
// que toda la app —pública y privada— tome el color de marca. El sidebar y el marco viven en (app).

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await obtenerConfiguracion();
  return {
    title: `${cfg.nombre} · Homologaciones`,
    description:
      "Compara el certificado de notas de un estudiante de otra universidad contra el plan de estudios y sugiere en qué semestre podría ubicarse.",
    robots: "noindex, nofollow",
  };
}

export default async function LayoutRaiz({ children }: { children: React.ReactNode }) {
  const cfg = await obtenerConfiguracion();
  // Variables de marca + color de las notificaciones (sileo lee --sileo-state-* de su contenedor;
  // como los toast se portalizan al body, fijarlas aquí las tiñe del color elegido).
  const estilo = {
    ...variablesDeMarca(cfg),
    "--sileo-state-success": cfg.notifColor,
    "--sileo-state-info": cfg.notifColor,
  } as React.CSSProperties;

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Paleta del modo oscuro elegida por la institución (recolorea las superficies bajo .dark). */}
        <style dangerouslySetInnerHTML={{ __html: cssTemaOscuro(cfg.temaOscuro) }} />
      </head>
      <body style={estilo}>
        <ProveedorTema>
          {children}
          <Notificaciones posicion={cfg.notifPosicion} />
        </ProveedorTema>
      </body>
    </html>
  );
}
