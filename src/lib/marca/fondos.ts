// Degradados predefinidos para el fondo del login. La institución elige uno desde el panel; se guarda
// solo la CLAVE. El preset 'marca' usa las variables de color de la institución (--marca / --acento),
// así se adapta solo; el resto son combinaciones fijas y cuidadas.

export const FONDOS = [
  { clave: "marca", nombre: "Marca", gradiente: "linear-gradient(135deg, var(--marca), #0b1220 55%, var(--acento))" },
  { clave: "medianoche", nombre: "Medianoche", gradiente: "linear-gradient(135deg, #0f172a, #1e3a8a 60%, #312e81)" },
  { clave: "oceano", nombre: "Océano", gradiente: "linear-gradient(135deg, #0c4a6e, #0e7490 55%, #155e75)" },
  { clave: "ocaso", nombre: "Ocaso", gradiente: "linear-gradient(135deg, #7c2d12, #be185d 55%, #6d28d9)" },
  { clave: "bosque", nombre: "Bosque", gradiente: "linear-gradient(135deg, #064e3b, #047857 55%, #14532d)" },
  { clave: "violeta", nombre: "Violeta", gradiente: "linear-gradient(135deg, #4c1d95, #7c3aed 55%, #db2777)" },
  { clave: "grafito", nombre: "Grafito", gradiente: "linear-gradient(135deg, #0f172a, #1e293b 55%, #475569)" },
] as const;

export type ClaveFondo = (typeof FONDOS)[number]["clave"];

export const CLAVES_FONDO: string[] = FONDOS.map((f) => f.clave);

export function gradienteDe(clave: string): string {
  return FONDOS.find((f) => f.clave === clave)?.gradiente ?? FONDOS[0].gradiente;
}
