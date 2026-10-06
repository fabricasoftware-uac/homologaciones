import { proyectarCursosAutomaticos, normalizarNombre, type AsignaturaProyeccion } from "../src/lib/acta/proyeccion-matricula";

// Mock amplio de asignaturas
const pensumCompleto: AsignaturaProyeccion[] = [
  // Semestre 1 (5 materias)
  { id: "1-1", codigo: "MAT101", nombre: "Cálculo Diferencial", semestre: 1, creditos: 3 },
  { id: "1-2", codigo: "PROG101", nombre: "Fundamentos de Programación", semestre: 1, creditos: 3 },
  { id: "1-3", codigo: "HUM101", nombre: "Competencias Comunicativas", semestre: 1, creditos: 2 },
  { id: "1-4", codigo: "ALG101", nombre: "Álgebra Lineal", semestre: 1, creditos: 3 },
  { id: "1-5", codigo: "ING101", nombre: "Introducción a la Ingeniería", semestre: 1, creditos: 2 },

  // Semestre 2 (5 materias)
  { id: "2-1", codigo: "MAT102", nombre: "Cálculo Integral", semestre: 2, creditos: 3 },
  { id: "2-2", codigo: "PROG102", nombre: "Programación Orientada a Objetos", semestre: 2, creditos: 3 },
  { id: "2-3", codigo: "FIS101", nombre: "Física Mecánica", semestre: 2, creditos: 3 },
  { id: "2-4", codigo: "DIS101", nombre: "Matemáticas Discretas", semestre: 2, creditos: 3 },
  { id: "2-5", codigo: "ETI101", nombre: "Ética y Constitución", semestre: 2, creditos: 2 },

  // Semestre 3 (5 materias)
  { id: "3-1", codigo: "PROG201", nombre: "Estructuras de Datos", semestre: 3, creditos: 4 },
  { id: "3-2", codigo: "BD201", nombre: "Bases de Datos I", semestre: 3, creditos: 3 },
  { id: "3-3", codigo: "FIS102", nombre: "Física Eléctrica", semestre: 3, creditos: 3 },
  { id: "3-4", codigo: "MAT201", nombre: "Ecuaciones Diferenciales", semestre: 3, creditos: 3 },
  { id: "3-5", codigo: "ARQ201", nombre: "Arquitectura de Computadores", semestre: 3, creditos: 3 },
];

let testsPasados = 0;
let testsTotales = 0;

function afirmar(condicion: boolean, mensaje: string) {
  testsTotales++;
  if (!condicion) {
    console.error(`❌ FALLÓ: ${mensaje}`);
    throw new Error(mensaje);
  }
  testsPasados++;
  console.log(`✅ PASÓ: ${mensaje}`);
}

console.log("=== INICIANDO AUDITORÍA DEL ALGORITMO DE PROYECCIÓN ===");

// Caso 1: Estudiante nuevo en Semestre 1 sin homologaciones
const c1 = proyectarCursosAutomaticos(pensumCompleto, [], 1, 6);
afirmar(c1.length === 6, "Caso 1: Completa exactamente 6 materias");
afirmar(c1.filter(a => a.semestre === 1).length === 5, "Caso 1: Contiene las 5 materias de Semestre 1");
afirmar(c1[5].semestre === 2, "Caso 1: La 6ta materia la toma de Semestre 2");

// Caso 2: Estudiante con todo Semestre 1 homologado, entra a Semestre 2
const homSem1 = pensumCompleto.filter(a => a.semestre === 1).map(a => a.nombre);
const c2 = proyectarCursosAutomaticos(pensumCompleto, { nombres: homSem1 }, 2, 6);
afirmar(c2.length === 6, "Caso 2: Proyecta 6 materias sin incluir ninguna de Semestre 1");
afirmar(c2.every(a => a.semestre >= 2), "Caso 2: Todas las asignaturas son de Semestre 2 o superior");
afirmar(c2.filter(a => a.semestre === 2).length === 5, "Caso 2: Incluye las 5 materias completas de Semestre 2");
afirmar(c2[5].semestre === 3, "Caso 2: Completa la 6ta con una de Semestre 3");

// Caso 3: Normalización insensible a mayúsculas, tildes y espacios
const homConVariaciones = ["cAlCuLo DiFeReNcIaL", "FUNDAMENTOS   DE PROGRAMACION", "Álgebra Lineal "];
const c3 = proyectarCursosAutomaticos(pensumCompleto, { nombres: homConVariaciones }, 1, 6);
afirmar(!c3.some(a => a.nombre === "Cálculo Diferencial"), "Caso 3: Excluye Cálculo Diferencial a pesar de variaciones de caso");
afirmar(!c3.some(a => a.nombre === "Fundamentos de Programación"), "Caso 3: Excluye Fundamentos a pesar de espacios y sin tilde");
afirmar(!c3.some(a => a.nombre === "Álgebra Lineal"), "Caso 3: Excluye Álgebra Lineal");

// Caso 4: Pensum pequeño con menos de 6 materias en total
const pensumPequeno = pensumCompleto.slice(0, 3);
const c4 = proyectarCursosAutomaticos(pensumPequeno, [], 1, 6);
afirmar(c4.length === 3, "Caso 4: No se rompe con pensums pequeños (< 6 materias)");

// Caso 5: Todo el pensum homologado (100%)
const todosNombres = pensumCompleto.map(a => a.nombre);
const c5 = proyectarCursosAutomaticos(pensumCompleto, { nombres: todosNombres }, 1, 6);
afirmar(c5.length === 0, "Caso 5: Retorna array vacío cuando no hay pendientes");

// Caso 6: Prioridad estricta de materias rezagadas
// Estudiante entra a Semestre 3, debe 1 de Sem 1 y 1 de Sem 2
const homParcial = [
  "Cálculo Diferencial", "Fundamentos de Programación", "Álgebra Lineal", "Introducción a la Ingeniería",
  "Cálculo Integral", "Programación Orientada a Objetos", "Física Mecánica", "Matemáticas Discretas"
];
// Pendientes: "Competencias Comunicativas" (Sem 1) y "Ética y Constitución" (Sem 2)
const c6 = proyectarCursosAutomaticos(pensumCompleto, { nombres: homParcial }, 3, 6);
afirmar(c6[0].nombre === "Competencias Comunicativas" && c6[0].semestre === 1, "Caso 6: Rezagada de Sem 1 va en posición #1");
afirmar(c6[1].nombre === "Ética y Constitución" && c6[1].semestre === 2, "Caso 6: Rezagada de Sem 2 va en posición #2");
afirmar(c6.slice(2).every(a => a.semestre === 3), "Caso 6: Las restantes 4 materias son del Semestre de ingreso (Sem 3)");

console.log(`\n=== AUDITORÍA FINALIZADA: ${testsPasados}/${testsTotales} PRUEBAS EXITOSAS ===\n`);
