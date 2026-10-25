import fs from "node:fs";
import path from "node:path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  Footer,
  ImageRun,
  convertInchesToTwip,
} from "docx";

import {
  formatearCursoCapitalizado,
  type DatosResolucion,
} from "./documento";

const COLOR_AZUL_INSTITUCIONAL = "002060";
const COLOR_TEXTO = "000000";
const COLOR_GRIS_FOOTER = "475569";
const FUENTE_PRINCIPAL = "Arial";

const BORDE_NEGRO = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: "000000",
};

const BORDES_TABLA = {
  top: BORDE_NEGRO,
  bottom: BORDE_NEGRO,
  left: BORDE_NEGRO,
  right: BORDE_NEGRO,
  insideHorizontal: BORDE_NEGRO,
  insideVertical: BORDE_NEGRO,
};

const MARGENES_CELDA = {
  top: 80,
  bottom: 80,
  left: 100,
  right: 100,
};

function celdaEncabezadoAzul(
  texto: string,
  widthPercent: number,
  colSpan = 1,
  centrado = false,
): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    columnSpan: colSpan > 1 ? colSpan : undefined,
    shading: { fill: COLOR_AZUL_INSTITUCIONAL, type: ShadingType.CLEAR },
    margins: MARGENES_CELDA,
    children: [
      new Paragraph({
        alignment: centrado ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({
            text: texto,
            bold: true,
            color: "FFFFFF",
            font: FUENTE_PRINCIPAL,
            size: 17, // 8.5 pt
          }),
        ],
      }),
    ],
  });
}

function celdaDato(
  texto: string | number,
  widthPercent: number,
  colSpan = 1,
  centrado = false,
  negrita = false,
  tamanio = 17, // 8.5 pt
): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    columnSpan: colSpan > 1 ? colSpan : undefined,
    margins: MARGENES_CELDA,
    children: [
      new Paragraph({
        alignment: centrado ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({
            text: String(texto ?? ""),
            bold: negrita,
            color: COLOR_TEXTO,
            font: FUENTE_PRINCIPAL,
            size: tamanio,
          }),
        ],
      }),
    ],
  });
}

/**
 * Genera el documento oficial de Resolución de Homologación en formato Microsoft Word (.docx)
 * con exacta fidelidad a la plantilla institucional oficial de la Vicerrectoría Académica.
 */
export async function generarActaDocx(datos: DatosResolucion): Promise<Buffer> {
  const totalCreditosHomologados = datos.homologaciones.reduce(
    (acc, h) => acc + (Number(h.creditos) || 0),
    0,
  );
  const totalCursosMatricula = datos.cursosMatricula.length;
  const totalCreditosMatricula = datos.cursosMatricula.reduce(
    (acc, c) => acc + (Number(c.creditos) || 0),
    0,
  );
  const totalFolios =
    (datos.foliosSolicitud || 1) +
    (datos.foliosCertificado || 0) +
    (datos.foliosContenidos || 0);

  // Logo institucional
  const logoElements: Paragraph[] = [];
  const rutaLogo =
    datos.logoPath && fs.existsSync(datos.logoPath)
      ? datos.logoPath
      : path.join(process.cwd(), "public/resolucion/logo-uniautonoma.png");

  if (fs.existsSync(rutaLogo)) {
    try {
      const bufferLogo = fs.readFileSync(rutaLogo);
      logoElements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 140 },
          children: [
            new ImageRun({
              type: "png",
              data: bufferLogo,
              transformation: {
                width: 220,
                height: 48,
              },
            }),
          ],
        }),
      );
    } catch (e) {
      console.error("[generarActaDocx] Error al cargar logo:", e);
    }
  }

  // Filas Tabla 1: Cursos Homologados (Artículo 1°)
  const filasTabla1: TableRow[] = [
    // Fila 1: Programa de origen
    new TableRow({
      cantSplit: true,
      children: [
        celdaEncabezadoAzul("PROGRAMA DE ORIGEN:", 33, 3),
        celdaEncabezadoAzul(datos.programaOrigen.toUpperCase(), 67, 5),
      ],
    }),
    // Fila 2: Institución de origen
    new TableRow({
      cantSplit: true,
      children: [
        celdaEncabezadoAzul("INSTITUCIÓN DE ORIGEN:", 33, 3),
        celdaEncabezadoAzul(datos.institucionOrigen.toUpperCase(), 67, 5),
      ],
    }),
    // Fila 3: Banner central
    new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnSpan: 8,
          margins: { top: 90, bottom: 90, left: 100, right: 100 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "CURSOS ACADÉMICOS HOMOLOGADOS",
                  bold: true,
                  color: COLOR_TEXTO,
                  font: FUENTE_PRINCIPAL,
                  size: 18,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    // Fila 4: Encabezados de columna
    new TableRow({
      cantSplit: true,
      children: [
        celdaDato("NOMBRE CURSO INSTITUCIÓN DE ORIGEN", 26, 1, true, true, 15),
        celdaDato("CÓDIGO CURSO UNIAUTONOMA", 16, 1, true, true, 15),
        celdaDato("NOMBRE CURSO ACADÉMICO UNIAUTONOMA", 25, 1, true, true, 15),
        celdaDato("SEM.", 7, 1, true, true, 15),
        celdaDato("CR", 5, 1, true, true, 15),
        celdaDato("IH", 5, 1, true, true, 15),
        celdaDato("TIPO", 5, 1, true, true, 15),
        celdaDato("CALIFICACIÓN", 11, 1, true, true, 15),
      ],
    }),
  ];

  // Datos homologados
  for (const h of datos.homologaciones) {
    filasTabla1.push(
      new TableRow({
        cantSplit: true,
        children: [
          celdaDato(formatearCursoCapitalizado(h.materiaOrigen), 26, 1, false, false, 16),
          celdaDato(h.codigoUniautonoma || "—", 16, 1, true, false, 16),
          celdaDato(h.nombreAsignatura, 25, 1, false, false, 16),
          celdaDato(h.semestre || "—", 7, 1, true, false, 16),
          celdaDato(h.creditos || "—", 5, 1, true, false, 16),
          celdaDato(h.intensidadHoraria || "—", 5, 1, true, false, 16),
          celdaDato(h.tipo || "TP", 5, 1, true, false, 16),
          celdaDato(h.calificacion || "Aprobado", 11, 1, true, false, 16),
        ],
      }),
    );
  }

  // Totales homologación
  filasTabla1.push(
    new TableRow({
      cantSplit: true,
      children: [
        celdaDato("TOTAL CURSOS HOMOLOGADOS:", 67, 3, true, true, 17),
        celdaDato(datos.homologaciones.length, 33, 5, true, true, 17),
      ],
    }),
    new TableRow({
      cantSplit: true,
      children: [
        celdaDato("TOTAL CRÉDITOS HOMOLOGADOS:", 67, 3, true, true, 17),
        celdaDato(totalCreditosHomologados, 33, 5, true, true, 17),
      ],
    }),
  );

  const tabla1 = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDES_TABLA,
    rows: filasTabla1,
  });

  // Filas Tabla 2: Folios de documentos analizados (Artículo 2°)
  const tabla2 = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDES_TABLA,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          celdaEncabezadoAzul("DOCUMENTO", 80),
          celdaEncabezadoAzul("N0. DE FOLIOS", 20, 1, true),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          celdaDato("Formato de solicitud del aspirante/estudiante.", 80, 1, false, false, 17),
          celdaDato(datos.foliosSolicitud || 1, 20, 1, true, false, 17),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          celdaDato(
            "Certificado oficial de calificaciones, en el cual deben figurar todas las asignaturas cursadas por estudiantes, la intensidad horaria total, los créditos académicos y la calificación de cada una de ellas.",
            80,
            1,
            false,
            false,
            17,
          ),
          celdaDato(datos.foliosCertificado || "—", 20, 1, true, false, 17),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          celdaDato(
            "Documento debidamente refrendado en donde conste el contenido programático de las asignaturas cursadas y aprobadas.",
            80,
            1,
            false,
            false,
            17,
          ),
          celdaDato(datos.foliosContenidos ? datos.foliosContenidos : "—", 20, 1, true, false, 17),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          celdaDato("TOTAL FOLIOS", 80, 1, false, true, 17),
          celdaDato(totalFolios, 20, 1, true, true, 17),
        ],
      }),
    ],
  });

  // Filas Tabla 3: Cursos de Matrícula (Artículo 3°)
  const filasTabla3: TableRow[] = [
    new TableRow({
      cantSplit: true,
      children: [
        celdaEncabezadoAzul("NO", 6, 1, true),
        celdaEncabezadoAzul("CÓDIGO DEL CURSO", 18, 1, true),
        celdaEncabezadoAzul("CURSO", 44, 1, true),
        celdaEncabezadoAzul("SEM.", 8, 1, true),
        celdaEncabezadoAzul("CR", 8, 1, true),
        celdaEncabezadoAzul("IH", 8, 1, true),
        celdaEncabezadoAzul("TP", 8, 1, true),
      ],
    }),
  ];

  for (let i = 0; i < datos.cursosMatricula.length; i++) {
    const c = datos.cursosMatricula[i];
    filasTabla3.push(
      new TableRow({
        cantSplit: true,
        children: [
          celdaDato(c.no || i + 1, 6, 1, true, false, 16),
          celdaDato(c.codigo || "—", 18, 1, true, false, 16),
          celdaDato(c.curso, 44, 1, false, false, 16),
          celdaDato(c.semestre || "—", 8, 1, true, false, 16),
          celdaDato(c.creditos || "—", 8, 1, true, false, 16),
          celdaDato(c.intensidadHoraria || "—", 8, 1, true, false, 16),
          celdaDato(c.tipo || "TP", 8, 1, true, false, 16),
        ],
      }),
    );
  }

  filasTabla3.push(
    new TableRow({
      cantSplit: true,
      children: [
        celdaDato("TOTAL CURSOS", 68, 3, false, true, 17),
        celdaDato(totalCursosMatricula, 32, 4, true, true, 17),
      ],
    }),
    new TableRow({
      cantSplit: true,
      children: [
        celdaDato("TOTAL CREDITOS", 68, 3, false, true, 17),
        celdaDato(totalCreditosMatricula, 32, 4, true, true, 17),
      ],
    }),
  );

  const tabla3 = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDES_TABLA,
    rows: filasTabla3,
  });

  const parrafoEspaciado = (
    texto: string,
    bold = false,
    after = 120,
    alineacion = AlignmentType.JUSTIFIED,
  ) =>
    new Paragraph({
      alignment: alineacion,
      spacing: { after, line: 260 },
      children: [
        new TextRun({
          text: texto,
          bold,
          color: COLOR_TEXTO,
          font: FUENTE_PRINCIPAL,
          size: 19, // 9.5 pt
        }),
      ],
    });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.9),
              left: convertInchesToTwip(0.9),
              right: convertInchesToTwip(0.9),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { line: 200, before: 60 },
                children: [
                  new TextRun({
                    text: "NIT: 891.501.766-6 Lic. De Funcionamiento: 1232 de 1979. Resolución MEN Nº. 677 de 2003. Código SNIES: 2849",
                    color: COLOR_GRIS_FOOTER,
                    font: FUENTE_PRINCIPAL,
                    size: 14, // 7 pt
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { line: 200 },
                children: [
                  new TextRun({
                    text: "Sede principal Calle 5 3-85 Barrio Centro. PBX: 602 8222295 – WhatsApp 314 639 54 95 – 320 675 04 64 A.A. 043 Popayán - Cauca - Colombia.",
                    color: COLOR_GRIS_FOOTER,
                    font: FUENTE_PRINCIPAL,
                    size: 14,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { line: 200 },
                children: [
                  new TextRun({
                    text: "www.uniautonoma.edu.co - Email: recepcion@uniautonoma.edu.co",
                    color: COLOR_GRIS_FOOTER,
                    font: FUENTE_PRINCIPAL,
                    size: 14,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Logo centrado
          ...logoElements,

          // Título de la Resolución
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 40 },
            children: [
              new TextRun({
                text: `RESOLUCIÓN No. ${datos.numeroResolucion || "XXX"}`,
                bold: true,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 21, // 10.5 pt
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: datos.fechaResolucionEncabezado,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19, // 9.5 pt
              }),
            ],
          }),

          // Epígrafe
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 140, line: 260 },
            children: [
              new TextRun({
                text: `POR LA CUAL SE APRUEBA EL ESTUDIO DE HOMOLOGACIÓN DE LOS CURSOS APROBADOS EN EL PROGRAMA, ${datos.programaOrigen.toUpperCase()} DE LA ${datos.institucionOrigen.toUpperCase()}, SOLICITADOS POR ${datos.solicitanteNombre.toUpperCase()}, IDENTIFICADO CON CÉDULA DE CIUDADANÍA No. ${datos.solicitanteCedula || "—"} ${datos.solicitanteLugarExp ? `DE ${datos.solicitanteLugarExp.toUpperCase()}` : ""}.`,
                bold: true,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
            ],
          }),

          // Párrafo de atribuciones reglamentarias
          parrafoEspaciado(
            "El suscrito Vicerrector Académico de la CORPORACIÓN UNIVERSITARIA AUTÓNOMA DEL CAUCA, en uso de sus atribuciones reglamentarias en especial las conferidas en el artículo 22 del Acuerdo 006 de 2016 de los Estatutos institucionales y el artículo 57 del Acuerdo 005 de 2025. del Reglamento estudiantil, y",
          ),

          // CONSIDERANDO:
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 80, after: 80 },
            children: [
              new TextRun({
                text: "CONSIDERANDO:",
                bold: true,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
            ],
          }),

          // 3 Considerandos
          parrafoEspaciado(
            `Que la Coordinación del Programa de ${datos.carreraDestino} realizó el estudio de homologación de los cursos aprobados por ${datos.solicitanteNombre.toUpperCase()}, identificado con CÉDULA DE CIUDADANÍA No. ${datos.solicitanteCedula || "—"} ${datos.solicitanteLugarExp ? `DE ${datos.solicitanteLugarExp.toUpperCase()}` : ""}, en la ${datos.institucionOrigen.toUpperCase()};`,
          ),
          parrafoEspaciado(
            `Que el Vicerrector Académico revisó los procedimientos aplicados y los anexos allegados por ${datos.solicitanteNombre.toUpperCase()}, para el estudio y análisis de la homologación realizada por la Coordinación del Programa ${datos.carreraDestino}, con el correspondiente pensum vigente del Programa de ${datos.carreraDestino} aprobado mediante Resolución ${datos.resolucionMen || "expedida por el Ministerio de Educación Nacional"};`,
          ),
          parrafoEspaciado(
            "Que para los casos de corrección de errores de digitación numéricos o en nombres, el Código de procedimiento administrativo y de lo contencioso administrativo, Ley 1437 de 2011 prevé la expedición de nuevos actos administrativos, sin que ello altere el sentido material de la decisión o la reactivación de términos para ejercer la vía administrativa, decisión que deberá ser notificada al interesado;",
          ),

          // RESUELVE:
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 80, after: 80 },
            children: [
              new TextRun({
                text: "RESUELVE:",
                bold: true,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
            ],
          }),

          // ARTICULO 1°
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 60, line: 260 },
            children: [
              new TextRun({
                text: "ARTICULO 1°. ",
                bold: true,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
              new TextRun({
                text: `Aprobar el estudio de homologación presentado por ${datos.solicitanteNombre.toUpperCase()}, identificado con la cédula de ciudadanía No. ${datos.solicitanteCedula || "—"} ${datos.solicitanteLugarExp ? `DE ${datos.solicitanteLugarExp.toUpperCase()}` : ""}, de la siguiente manera:`,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
            ],
          }),

          // Glosario
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: "Entiéndase: CR: Crédito Académico, IH: Intensidad Horaria: Tipo: T: Teórico, P: Práctico; TP: Teórico Práctico, NA: No Aplica.",
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 17, // 8.5 pt
              }),
            ],
          }),

          // TABLA 1
          tabla1,

          // ARTICULO 2°
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 160, after: 80, line: 260 },
            children: [
              new TextRun({
                text: "ARTICULO 2°. ",
                bold: true,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
              new TextRun({
                text: "Para realizar este estudio se analizaron los siguientes documentos, los cuales reposarán en la hoja de vida del aspirante/estudiante:",
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
            ],
          }),

          // TABLA 2
          tabla2,

          // ARTICULO 3°
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 160, after: 80, line: 260 },
            children: [
              new TextRun({
                text: "ARTICULO 3°. ",
                bold: true,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
              new TextRun({
                text: `Se proyecta la matrícula de los siguientes cursos para el primer período académico de ${datos.periodoMatricula || "2026 (1P-2026)"}:`,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
            ],
          }),

          // TABLA 3
          tabla3,

          // PARÁGRAFOS
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 140, after: 100, line: 260 },
            children: [
              new TextRun({
                text: "PARÁGRAFO 1. ",
                bold: true,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
              new TextRun({
                text: `Para legalizar el proceso de matrícula tanto académica como financiera, deberá cancelar los derechos pecuniarios correspondientes antes del ${datos.fechaLimitePago || "fijado en el calendario institucional"}.`,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 100, line: 260 },
            children: [
              new TextRun({
                text: "PARÁGRAFO 2. ",
                bold: true,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
              new TextRun({
                text: "El aspirante/estudiante tendrá derecho a solicitar la revisión del estudio, para lo cual tendrá un plazo máximo de ocho (8) días calendario siguientes a su notificación, siempre y cuando esta revisión se refiera a la documentación entregada inicialmente. Cuando el aspirante/estudiante desee incorporar nuevos contenidos, se debe solicitar y realizar un nuevo estudio de homologación.",
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
            ],
          }),

          // ARTICULO 4°
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 160, line: 260 },
            children: [
              new TextRun({
                text: "ARTICULO 4°. ",
                bold: true,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
              new TextRun({
                text: "La presente resolución rige a partir de la fecha de su expedición.",
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
            ],
          }),

          // NOTIFIQUESE Y CUMPLASE
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 140, after: 60 },
            children: [
              new TextRun({
                text: "NOTIFIQUESE Y CUMPLASE",
                bold: true,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 280 },
            children: [
              new TextRun({
                text: datos.fechaLegalCierre,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
            ],
          }),

          // Firma Vicerrector
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: "SEBASTIÁN TORO VÉLEZ Ph.D.(c)",
                bold: true,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: "Vicerrector Académico",
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 19,
              }),
            ],
          }),

          // Bloque de notificación y firmas
          new Paragraph({
            spacing: { line: 240 },
            children: [
              new TextRun({
                text: "Notificada(o): ",
                bold: true,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 18,
              }),
              new TextRun({
                text: datos.solicitanteNombre,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            spacing: { line: 240 },
            children: [
              new TextRun({
                text: `Cédula de ciudadanía No. ${datos.solicitanteCedula || "—"} ${datos.solicitanteLugarExp ? `DE ${datos.solicitanteLugarExp.toUpperCase()}` : ""}`,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            spacing: { line: 240 },
            children: [
              new TextRun({
                text: `Fecha de notificación: ${datos.fechaNotificacion}`,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 80, line: 240 },
            children: [
              new TextRun({
                text: "Copia: Oficina de mercadeo y admisiones",
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            spacing: { line: 240 },
            children: [
              new TextRun({
                text: "Gestión documental",
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            spacing: { line: 240 },
            children: [
              new TextRun({
                text: "Oficina control y registro académico",
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 80, line: 240 },
            children: [
              new TextRun({
                text: `Elaboró: ${datos.coordinadorNombre || "Coordinación de Programa"}`,
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            spacing: { line: 240 },
            children: [
              new TextRun({
                text: "Revisó: Saide López.",
                color: COLOR_TEXTO,
                font: FUENTE_PRINCIPAL,
                size: 18,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
