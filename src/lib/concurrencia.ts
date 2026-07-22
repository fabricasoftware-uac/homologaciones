// Ejecuta una tarea por cada elemento, con un TOPE de tareas en vuelo, y devuelve los resultados
// ALINEADOS con la entrada (mismo orden, misma longitud) sin importar en qué orden terminen.
//
// Existe porque el pipeline estaba lleno de bucles `for (...) { await ... }`: correctos, pero
// SECUENCIALES. Cuando cada vuelta es un viaje de red (una llamada al LLM, un RPC a Postgres), el
// tiempo total es la SUMA de todas. Con las latencias reales medidas —13 s por microlote del LLM en
// el tier gratuito— cinco lotes en serie son 66 s de espera para el estudiante; en paralelo, ~15 s.
//
// El tope importa: sin él, 19 llamadas simultáneas al proveedor gratuito disparan rate-limits (su
// límite ronda las 20 peticiones por minuto) y se pierde más de lo que se gana.
export async function mapaConcurrente<T, R>(
  elementos: T[],
  limite: number,
  tarea: (elemento: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const resultados = new Array<R>(elementos.length);
  if (elementos.length === 0) return resultados;

  // Un cursor compartido entre N obreros: cada uno toma el siguiente índice libre y lo procesa. Así
  // el reparto se autoequilibra (si una tarea tarda mucho, las demás siguen avanzando) sin trocear
  // la lista de antemano.
  let siguiente = 0;
  const obreros = Array.from({ length: Math.max(1, Math.min(limite, elementos.length)) }, async () => {
    for (;;) {
      const i = siguiente++;
      if (i >= elementos.length) return;
      resultados[i] = await tarea(elementos[i], i);
    }
  });

  await Promise.all(obreros);
  return resultados;
}
