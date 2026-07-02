import type { MateriaExtraida, Extractor } from "./tipos";

export class SenaParser implements Extractor {
  readonly nombre = "SenaParser";

  async extraer(texto: string): Promise<MateriaExtraida[]> {
    const txt = texto.replace(/\s+/g, " ").trim();

    const regex = /(.+?)\s+[\d,]+\s+([AD])\s+REGISTRO\s+DE\s+COMPETENCIAS\s+EVALUADAS\s+EVAL\s+IH\s+(\d+)\s+RESULTADOS\s+DE\s+APRENDIZAJE\s+(.+?)(?=\s*(?:[\d,]+\s+[AD]\s+REGISTRO|$))/g;

    const unidades: MateriaExtraida[] = [];
    let m: RegExpExecArray | null;
    let esPrimero = true;

    while ((m = regex.exec(txt)) !== null) {
      let nombre = m[1].trim();
      const ih = parseInt(m[3], 10);
      const raTexto = m[4];
      const evaluacion = m[2];

      if (esPrimero) {
        const limpio = nombre.match(/(?:ha\s+)?aprobado:\s*(.+)/i);
        if (limpio) nombre = limpio[1].trim();
        esPrimero = false;
      }

      nombre = nombre.replace(/\s+/g, " ");

      const ras: string[] = [];
      const partesRA = raTexto.split(/\s+(?=\d{2}\s+)/);
      for (const p of partesRA) {
        const textoRA = p.replace(/^\d{2}\s+/, "").replace(/\s+/g, " ").trim();
        if (textoRA.length > 10) ras.push(textoRA);
      }

      const raFormateado = ras.length > 0
        ? "\n\nResultados de aprendizaje:\n" + ras.map((r) => `- ${r}`).join("\n")
        : "";

      const nota = evaluacion === "A" ? "Aprobado" : evaluacion === "D" ? "No aprobado" : evaluacion;

      unidades.push({
        nombre: `Competencia:\n${nombre}${raFormateado}`,
        codigo: null,
        creditos: ih,
        nota,
        semestre_origen: null,
        tipo: "competencia",
        metadatos: { resultados_aprendizaje: ras },
      });
    }

    console.log(`[extraccion] SenaParser extrajo ${unidades.length} competencias.`);
    return unidades;
  }
}
