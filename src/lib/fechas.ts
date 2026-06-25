// Filtro de fechas compartido por la bandeja y los reportes. Define los periodos rápidos y convierte
// los parámetros de la URL (periodo o rango personalizado desde/hasta) en un rango de fechas ISO que
// el servidor aplica con gte/lte sobre `creado_en`.
//
// Los periodos "Hoy / Este mes / Este año" son de CALENDARIO (desde las 00:00 del día / 1.° del mes /
// 1.° de enero), no ventanas móviles: así "Este mes" muestra justo el mes en curso. "Última hora" y
// "7 días" sí son móviles.

export const PERIODOS = [
  { clave: "1h", label: "Última hora" },
  { clave: "hoy", label: "Hoy" },
  { clave: "7d", label: "7 días" },
  { clave: "mes", label: "Este mes" },
  { clave: "anio", label: "Este año" },
  { clave: "todo", label: "Todo" },
] as const;

export type Rango = { desde: string | null; hasta: string | null };

export type ParamsFecha = { periodo?: string; desde?: string; hasta?: string };

export function rangoDesdeParams(p: ParamsFecha): Rango {
  // Un rango personalizado (desde/hasta en formato YYYY-MM-DD) tiene prioridad sobre el periodo.
  if (p.desde || p.hasta) {
    return {
      desde: p.desde ? new Date(`${p.desde}T00:00:00`).toISOString() : null,
      hasta: p.hasta ? new Date(`${p.hasta}T23:59:59.999`).toISOString() : null,
    };
  }

  const ahora = new Date();
  switch (p.periodo) {
    case "1h":
      return { desde: new Date(ahora.getTime() - 3_600_000).toISOString(), hasta: null };
    case "hoy": {
      const d = new Date(ahora);
      d.setHours(0, 0, 0, 0);
      return { desde: d.toISOString(), hasta: null };
    }
    case "7d":
      return { desde: new Date(ahora.getTime() - 7 * 86_400_000).toISOString(), hasta: null };
    case "mes":
      return { desde: new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString(), hasta: null };
    case "anio":
      return { desde: new Date(ahora.getFullYear(), 0, 1).toISOString(), hasta: null };
    default:
      return { desde: null, hasta: null }; // "todo": sin filtro
  }
}

// Clave del periodo activo para resaltar en el filtro (o "personalizado" si hay rango a mano).
export function periodoActivo(p: ParamsFecha): string {
  if (p.desde || p.hasta) return "personalizado";
  return p.periodo ?? "todo";
}
