import clsx from "clsx";

import type { Configuracion } from "@/lib/marca/configuracion";

// Logo de la institución, reutilizable (sidebar, menú móvil, login). Si subió su imagen, la muestra
// en un contenedor limpio; si no, un monograma con DEGRADADO del color de marca, anillo y sombra —
// bastante más cuidado que el cuadro plano de antes.
const TAM = {
  sm: "w-9 h-9 text-base rounded-lg",
  md: "w-10 h-10 text-lg rounded-xl",
  lg: "w-16 h-16 text-2xl rounded-2xl",
} as const;

export function Logotipo({
  marca,
  size = "md",
  className,
  fondo = "auto",
}: {
  marca: Pick<Configuracion, "nombre" | "logoUrl" | "logoOscuroUrl">;
  size?: keyof typeof TAM;
  className?: string;
  // "auto": sigue el tema (claro en claro, oscuro en oscuro). "oscuro": superficie SIEMPRE oscura
  // (sidebar, panel del login), así que usa siempre la versión clara/blanca.
  fondo?: "auto" | "oscuro";
}) {
  const { logoUrl, logoOscuroUrl } = marca;

  // Superficie siempre oscura: usa la versión clara si existe (sin placa); si no, el logo normal con
  // placa para que se vea sobre el fondo oscuro.
  if (fondo === "oscuro" && (logoUrl || logoOscuroUrl)) {
    const elegido = logoOscuroUrl ?? logoUrl!;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={elegido}
        alt={marca.nombre}
        className={clsx(
          TAM[size],
          "object-contain shrink-0",
          logoOscuroUrl ? "p-0.5" : "bg-white p-1 ring-1 ring-black/5 shadow-sm",
          className,
        )}
      />
    );
  }

  // Si la institución subió AMBAS versiones, cada una se muestra en su modo (sin placa: vienen
  // diseñadas para su fondo). Una se oculta con dark:hidden y la otra con hidden dark:block.
  if (logoUrl && logoOscuroUrl) {
    return (
      <div className={clsx(TAM[size], "shrink-0 overflow-hidden", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={marca.nombre} className="w-full h-full object-contain p-0.5 dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoOscuroUrl} alt={marca.nombre} className="hidden w-full h-full object-contain p-0.5 dark:block" />
      </div>
    );
  }

  // Si solo hay una versión, se usa en ambos modos CON placa, para que se vea sobre cualquier fondo.
  const unico = logoUrl ?? logoOscuroUrl;
  if (unico) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={unico}
        alt={marca.nombre}
        className={clsx(
          TAM[size],
          "object-contain bg-white p-1 ring-1 ring-black/5 shadow-sm shrink-0",
          "dark:bg-slate-800 dark:ring-white/10 dark:shadow-none",
          className,
        )}
      />
    );
  }
  return (
    <div
      className={clsx(
        TAM[size],
        "shrink-0 flex items-center justify-center font-bold text-marca-fg",
        "bg-gradient-to-br from-marca to-marca-hover ring-1 ring-white/20 shadow-lg shadow-marca/25",
        className,
      )}
    >
      {marca.nombre.charAt(0).toUpperCase()}
    </div>
  );
}
