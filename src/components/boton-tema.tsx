"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { IconSun as Sun, IconMoon as Moon } from "@tabler/icons-react";
import clsx from "clsx";

// Botón para alternar entre claro y oscuro. El guard `montado` evita el desajuste de hidratación.
//
// Animación: usa la View Transitions API para revelar el nuevo tema con un CÍRCULO que se expande
// desde el punto donde se hizo clic (el efecto moderno de 2026). Si el navegador no la soporta o el
// usuario pidió menos movimiento, cambia el tema al instante, sin animación.
export function BotonTema({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const esOscuro = resolvedTheme === "dark";

  function cambiar(evento: React.MouseEvent<HTMLButtonElement>) {
    const nuevo = esOscuro ? "light" : "dark";

    const sinAnimacion =
      typeof window === "undefined" ||
      typeof document.startViewTransition !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (sinAnimacion) {
      setTheme(nuevo);
      return;
    }

    // Centro del círculo: el punto donde se hizo clic. Radio final: la esquina más lejana.
    const x = evento.clientX;
    const y = evento.clientY;
    const radio = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const transicion = document.startViewTransition(() => {
      flushSync(() => setTheme(nuevo));
    });

    transicion.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radio}px at ${x}px ${y}px)`],
        },
        {
          duration: 480,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    });
  }

  return (
    <button
      type="button"
      onClick={cambiar}
      aria-label={esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={esOscuro ? "Modo claro" : "Modo oscuro"}
      className={clsx("transition-colors", className)}
    >
      {montado ? (
        esOscuro ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />
      ) : (
        <span className="block w-[18px] h-[18px]" />
      )}
    </button>
  );
}
