"use client";

import { useEffect, useRef } from "react";

// Partículas sutiles en canvas para el panel de marca del login: puntos blancos translúcidos que
// derivan lento y se unen con líneas tenues cuando están cerca (efecto constelación). Liviano: el
// número de puntos se calcula según el área y se cancela el loop al desmontar.
export function Particulas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const lienzo = ref.current;
    if (!lienzo) return;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let raf = 0;
    type Punto = { x: number; y: number; vx: number; vy: number; r: number; a: number };
    let puntos: Punto[] = [];

    function reset() {
      const rect = lienzo!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      lienzo!.width = Math.max(1, Math.floor(w * dpr));
      lienzo!.height = Math.max(1, Math.floor(h * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(70, Math.round((w * h) / 13000));
      puntos = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.5 + 0.6,
        a: Math.random() * 0.4 + 0.15,
      }));
    }

    const DIST = 130;
    function tick() {
      ctx!.clearRect(0, 0, w, h);
      for (let i = 0; i < puntos.length; i++) {
        const p = puntos[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        for (let j = i + 1; j < puntos.length; j++) {
          const q = puntos[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < DIST * DIST) {
            ctx!.strokeStyle = `rgba(255,255,255,${0.07 * (1 - d2 / (DIST * DIST))})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(p.x, p.y);
            ctx!.lineTo(q.x, q.y);
            ctx!.stroke();
          }
        }
      }
      for (const p of puntos) {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255,255,255,${p.a})`;
        ctx!.fill();
      }
      raf = requestAnimationFrame(tick);
    }

    reset();
    tick();
    const onResize = () => reset();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
