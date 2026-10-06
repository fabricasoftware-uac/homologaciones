import fs from "node:fs/promises";
import path from "node:path";
import { generarActaPdf, type DatosResolucion } from "../src/lib/acta/documento";

async function main() {
  console.log("Iniciando prueba de generación de PDF de Resolución...");

  const datosEjemplo: DatosResolucion = {
    numeroResolucion: "042",
    fechaResolucionEncabezado: "(15 de marzo de 2026)",
    fechaLegalCierre: "Popayán, a los quince (15) días del mes de marzo de dos mil veintiséis (2026)",
    fechaNotificacion: "16 de marzo de 2026",
    solicitanteNombre: "Carlos Alberto Pérez Rivera",
    solicitanteCedula: "1061789456",
    solicitanteLugarExp: "Popayán",
    institucionOrigen: "Universidad del Cauca",
    programaOrigen: "Ingeniería de Sistemas",
    carreraDestino: "Ingeniería de Software",
    resolucionMen: "Resolución No. 10245 del MEN",
    homologaciones: [
      {
        materiaOrigen: "CÁLCULO DIFERENCIAL E INTEGRAL",
        codigoUniautonoma: "MAT-101",
        nombreAsignatura: "Cálculo Diferencial",
        semestre: 1,
        creditos: 3,
        intensidadHoraria: 64,
        tipo: "T",
        calificacion: "4.2",
      },
      {
        materiaOrigen: "ALGORITMOS Y PROGRAMACIÓN I",
        codigoUniautonoma: "PROG-102",
        nombreAsignatura: "Fundamentos de Programación",
        semestre: 1,
        creditos: 3,
        intensidadHoraria: 64,
        tipo: "TP",
        calificacion: "4.5",
      },
      {
        materiaOrigen: "ÁLGEBRA LINEAL",
        codigoUniautonoma: "MAT-103",
        nombreAsignatura: "Álgebra Lineal",
        semestre: 1,
        creditos: 3,
        intensidadHoraria: 48,
        tipo: "T",
        calificacion: "3.8",
      },
      {
        materiaOrigen: "ESTRUCTURAS DE DATOS Y ALGORITMOS. MÉTODOS AVANZADOS",
        codigoUniautonoma: "PROG-201",
        nombreAsignatura: "Estructuras de Datos",
        semestre: 2,
        creditos: 4,
        intensidadHoraria: 80,
        tipo: "TP",
        calificacion: "4.0",
      },
      {
        materiaOrigen: "BASES DE DATOS RELACIONALES SQL",
        codigoUniautonoma: "BD-202",
        nombreAsignatura: "Gestión de Bases de Datos",
        semestre: 3,
        creditos: 3,
        intensidadHoraria: 64,
        tipo: "TP",
        calificacion: "4.1",
      },
    ],
    foliosSolicitud: 2,
    foliosCertificado: 4,
    foliosContenidos: 12,
    periodoMatricula: "2026 (1P-2026)",
    cursosMatricula: [
      {
        no: 1,
        codigo: "SOFT-301",
        curso: "Ingeniería de Requisitos",
        semestre: 3,
        creditos: 3,
        intensidadHoraria: 48,
        tipo: "T",
      },
      {
        no: 2,
        codigo: "SOFT-302",
        curso: "Arquitectura de Software",
        semestre: 3,
        creditos: 4,
        intensidadHoraria: 64,
        tipo: "TP",
      },
      {
        no: 3,
        codigo: "HUM-101",
        curso: "Competencias Comunicativas",
        semestre: 1,
        creditos: 2,
        intensidadHoraria: 32,
        tipo: "T",
      },
    ],
    fechaLimitePago: "25 de marzo de 2026",
    coordinadorNombre: "Ing. Diego Fernando Martínez",
    logoPath: path.join(process.cwd(), "public/resolucion/logo-uniautonoma.png"),
    vigiladoPath: path.join(process.cwd(), "public/resolucion/vigilado-mineducacion.png"),
  };

  const buffer = await generarActaPdf(datosEjemplo);
  console.log(`PDF generado con éxito. Tamaño: ${buffer.length} bytes.`);

  const outputPath = path.join(process.cwd(), "scratch/resolucion-test.pdf");
  await fs.writeFile(outputPath, buffer);
  console.log(`Archivo guardado en: ${outputPath}`);
}

main().catch((err) => {
  console.error("Error al generar PDF:", err);
  process.exit(1);
});
