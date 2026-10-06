import { proyectarCursosAutomaticos, type AsignaturaProyeccion } from "../src/lib/acta/proyeccion-matricula";

const pensumMock: AsignaturaProyeccion[] = [
  // Semestre 1
  { id: "1-1", codigo: "MAT101", nombre: "Cálculo Diferencial", semestre: 1, creditos: 3 },
  { id: "1-2", codigo: "PROG101", nombre: "Fundamentos de Programación", semestre: 1, creditos: 3 },
  { id: "1-3", codigo: "HUM101", nombre: "Competencias Comunicativas", semestre: 1, creditos: 2 },
  { id: "1-4", codigo: "ALG101", nombre: "Álgebra Lineal", semestre: 1, creditos: 3 },
  { id: "1-5", codigo: "ING101", nombre: "Introducción a la Ingeniería", semestre: 1, creditos: 2 },

  // Semestre 2
  { id: "2-1", codigo: "MAT102", nombre: "Cálculo Integral", semestre: 2, creditos: 3 },
  { id: "2-2", codigo: "PROG102", nombre: "Programación Orientada a Objetos", semestre: 2, creditos: 3 },
  { id: "2-3", codigo: "FIS101", nombre: "Física Mecánica", semestre: 2, creditos: 3 },
  { id: "2-4", codigo: "DIS101", nombre: "Matemáticas Discretas", semestre: 2, creditos: 3 },
  { id: "2-5", codigo: "ETI101", nombre: "Ética y Constitución", semestre: 2, creditos: 2 },

  // Semestre 3
  { id: "3-1", codigo: "PROG201", nombre: "Estructuras de Datos", semestre: 3, creditos: 4 },
  { id: "3-2", codigo: "BD201", nombre: "Bases de Datos I", semestre: 3, creditos: 3 },
  { id: "3-3", codigo: "FIS102", nombre: "Física Eléctrica", semestre: 3, creditos: 3 },
  { id: "3-4", codigo: "MAT201", nombre: "Ecuaciones Diferenciales", semestre: 3, creditos: 3 },
  { id: "3-5", codigo: "ARQ201", nombre: "Arquitectura de Computadores", semestre: 3, creditos: 3 },

  // Semestre 4
  { id: "4-1", codigo: "SOFT301", nombre: "Ingeniería de Software I", semestre: 4, creditos: 3 },
  { id: "4-2", codigo: "BD202", nombre: "Bases de Datos II", semestre: 4, creditos: 3 },
  { id: "4-3", codigo: "RED301", nombre: "Redes y Comunicaciones", semestre: 4, creditos: 3 },
  { id: "4-4", codigo: "WEB301", nombre: "Desarrollo Web", semestre: 4, creditos: 3 },
];

console.log("--- Caso 1: Estudiante entra a Semestre 3 ---");
// Homologó de sem 1: Cálculo Diferencial, Fundamentos, Álgebra Lineal, Introducción
// Faltó: Competencias Comunicativas (rezagada Sem 1!)
// Homologó de sem 2: Cálculo Integral, POO, Física Mecánica, Matemáticas Discretas
// Faltó: Ética y Constitución (rezagada Sem 2!)
// En Sem 3: homologó Bases de Datos I.
const homologadasNombres = [
  "Cálculo Diferencial",
  "Fundamentos de Programación",
  "Álgebra Lineal",
  "Introducción a la Ingeniería",
  "Cálculo Integral",
  "Programación Orientada a Objetos",
  "Física Mecánica",
  "Matemáticas Discretas",
  "Bases de Datos I",
];

const proyeccion = proyectarCursosAutomaticos(pensumMock, { nombres: homologadasNombres }, 3, 6);

console.log(`Proyectadas (${proyeccion.length} materias):`);
for (const p of proyeccion) {
  console.log(`  [Semestre ${p.semestre}] ${p.codigo}: ${p.nombre} (${p.creditos} cr)`);
}

// Validaciones
if (proyeccion[0].nombre !== "Competencias Comunicativas" || proyeccion[0].semestre !== 1) {
  throw new Error("Falla: Rezagada de Sem 1 debería ser primera");
}
if (proyeccion[1].nombre !== "Ética y Constitución" || proyeccion[1].semestre !== 2) {
  throw new Error("Falla: Rezagada de Sem 2 debería ser segunda");
}
// Las siguientes deben ser del Semestre 3 (no homologadas: Estructuras, Física Eléctrica, Ecuaciones, Arquitectura)
const nombresSem3 = proyeccion.slice(2).map((p) => p.nombre);
console.log("Materias del semestre 3 seleccionadas:", nombresSem3);
if (proyeccion.length !== 6) {
  throw new Error(`Falla: Se esperaban 6 materias y se obtuvieron ${proyeccion.length}`);
}

console.log("¡Prueba de proyección inteligente superada con éxito!");
