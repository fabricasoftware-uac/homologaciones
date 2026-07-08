import { getDocumentProxy } from "unpdf";

export type AsignaturaExtraida = {
  nombre: string;
  codigo: string | null;
  creditos: number;
  semestre: number;
};

const ROMANOS: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
};

function romanoANumero(romano: string): number | null {
  return ROMANOS[romano.toLowerCase()] ?? null;
}

export async function parsearPensum(bytes: Uint8Array): Promise<AsignaturaExtraida[]> {
  const pdf = await getDocumentProxy(bytes.slice());

  // 1. Extraer items con posición, ordenados por Y descendente (arriba → abajo).
  const items: { x: number; y: number; str: string }[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      items.push({ x: Math.round(it.transform[4]), y: Math.round(it.transform[5]), str: it.str.trim() });
    }
  }
  items.sort((a, b) => b.y - a.y);

  // 2. Encontrar marcadores de semestre con su columna.
  //    Izquierda: X < 220 (Semestres I-V),  Derecha: X >= 220 (VI-IX)
  const marcadores: { semestre: number; columna: "izq" | "der"; idx: number; y: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    const m = items[i].str.match(/^Semestre\s+(.+)$/i);
    if (!m) continue;
    const num = romanoANumero(m[1]);
    if (num === null) continue;
    marcadores.push({
      semestre: num,
      columna: items[i].x < 220 ? "izq" : "der",
      idx: i,
      y: items[i].y,
    });
  }

  // 3. Para cada marcador, recolectar sus materias: items entre este marcador y el siguiente
  //    DE LA MISMA COLUMNA.
  const resultado: AsignaturaExtraida[] = [];

  for (let k = 0; k < marcadores.length; k++) {
    const actual = marcadores[k];

    const nombreX = actual.columna === "izq" ? 64 : 272;
    const creditoX = actual.columna === "izq" ? 206 : 414;

    // Recolectar nombres y créditos.
    // Las materias de un semestre están POR ENCIMA de su marcador (Y mayor). El marcador
    // "Semestre X" va al pie de su columna; las materias y créditos están arriba.
    const nombres: { nombre: string; y: number }[] = [];
    const creditos: { cr: number; y: number }[] = [];

    // Calcular el Y del marcador del semestre ANTERIOR en la misma columna.
    let yDesde = 9999;
    for (let j = k - 1; j >= 0; j--) {
      if (marcadores[j].columna === actual.columna) { yDesde = marcadores[j].y; break; }
    }

    for (const it of items) {
      if (it.y >= yDesde) continue;
      // El marcador está ligeramente por encima de la última fila del bloque. Permitimos
      // 10px de tolerancia hacia abajo para capturar la última materia del semestre.
      if (it.y < actual.y - 40) continue;

      if (it.str.match(/^Semestre\s/i)) continue;
      if (it.str === "CURSO" || it.str === "CR") continue;
      if (actual.columna === "izq" && it.x >= 220) continue;
      if (actual.columna === "der" && it.x < 220) continue;

      if (Math.abs(it.x - creditoX) <= 10 && /^\d+$/.test(it.str)) {
        creditos.push({ cr: parseInt(it.str, 10), y: it.y });
      } else if (Math.abs(it.x - nombreX) <= 10) {
        nombres.push({ nombre: it.str, y: it.y });
      }
    }

    // Ordenar por Y descendente (las filas de arriba primero).
    nombres.sort((a, b) => b.y - a.y);
    creditos.sort((a, b) => b.y - a.y);

    // 4. Emparejar nombres y créditos por orden de Y. Si una fila de nombre está a ≤5px
    //    de la anterior y no tiene crédito propio, es continuación de un nombre multi-línea.
    const asignaturas: { nombre: string; creditos: number }[] = [];
    let nombrePendiente = "";

    let ci = 0;
    for (let ni = 0; ni < nombres.length; ni++) {
      const n = nombres[ni];

      // Buscar crédito en la misma fila (tolerancia 5px).
      let cr = 0;
      if (ci < creditos.length && Math.abs(creditos[ci].y - n.y) <= 5) {
        cr = creditos[ci].cr;
        ci++;
      }

      if (cr > 0) {
        // Esta fila tiene crédito: es una materia independiente.
        if (nombrePendiente) {
          nombrePendiente += " " + n.nombre;
          asignaturas.push({ nombre: nombrePendiente, creditos: cr });
          nombrePendiente = "";
        } else {
          asignaturas.push({ nombre: n.nombre, creditos: cr });
        }
      } else if (ni > 0 && Math.abs(nombres[ni - 1].y - n.y) <= 8) {
        // Sin crédito y muy cerca de la fila anterior: es continuación multi-línea.
        if (nombrePendiente) {
          nombrePendiente += " " + n.nombre;
        } else if (asignaturas.length > 0) {
          // La materia anterior era independiente pero esta fila es su continuación.
          const prev = asignaturas[asignaturas.length - 1];
          prev.nombre += " " + n.nombre;
        } else {
          nombrePendiente = n.nombre;
        }
      } else {
        // Sin crédito y separada: la guardamos como pendiente.
        nombrePendiente = n.nombre;
      }
    }

    for (const a of asignaturas) {
      resultado.push({
        nombre: a.nombre.replace(/\s+/g, " ").trim(),
        codigo: null,
        creditos: a.creditos,
        semestre: actual.semestre,
      });
    }
  }

  const vistas = new Set<string>();
  return resultado.filter((a) => {
    const clave = `${a.nombre.toLowerCase()}|${a.semestre}`;
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}
