import React from "react";
import path from "node:path";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";

// Desactivar corte silábico automático de palabras (evita "CALIFI-CACIÓN")
Font.registerHyphenationCallback((word) => [word]);

/**
 * Da formato a los cursos de procedencia según los estándares de la institución:
 * primera letra en mayúscula, o inmediatamente después de un punto, y el resto en minúsculas,
 * preservando números romanos (I, II, III, etc.) y siglas comunes.
 */
export function formatearCursoCapitalizado(texto: string | null | undefined): string {
  if (!texto) return "";
  const limpio = texto.trim();
  if (!limpio) return "";
  let s = limpio.toLocaleLowerCase("es");
  // Mayúscula al inicio y tras un punto seguido de espacio(s)
  s = s.replace(/(^\s*|\.\s+)([a-záéíóúüñ])/g, (_, prefijo, letra) => {
    return prefijo + letra.toLocaleUpperCase("es");
  });
  // Preservar números romanos
  s = s.replace(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/gi, (match) => match.toUpperCase());
  // Preservar siglas comunes
  s = s.replace(/\b(sena|tic|tics|bd|sql|ia|html|css|js|php|api|ip)\b/gi, (match) => match.toUpperCase());
  return s;
}

// ── FORMATO OFICIAL DE RESOLUCIÓN DE HOMOLOGACIÓN ──
// Vicerrectoría Académica · Corporación Universitaria Autónoma del Cauca
// Replicado fielmente del formato institucional oficial:
// FORMATO RESOL. HOMOLOGACIONES - VICERRECTORÍA ACADÉMICA.docx

export type FilaHomologada = {
  materiaOrigen: string;
  codigoUniautonoma: string;
  nombreAsignatura: string;
  semestre: number;
  creditos: number;
  intensidadHoraria: string | number;
  tipo: string;
  calificacion: string;
};

export type FilaCursoMatricula = {
  no: number;
  codigo: string;
  curso: string;
  semestre: number;
  creditos: number;
  intensidadHoraria: string | number;
  tipo: string;
};

export type DatosResolucion = {
  numeroResolucion: string;
  fechaResolucionEncabezado: string; // ej. "(03 de febrero de 2026)"
  fechaLegalCierre: string; // ej. "Popayán, a los tres (03) días del mes de febrero de dos mil veintiséis (2026)"
  fechaNotificacion: string;
  solicitanteNombre: string;
  solicitanteCedula: string;
  solicitanteLugarExp: string;
  institucionOrigen: string;
  programaOrigen: string;
  carreraDestino: string;
  resolucionMen: string;
  homologaciones: FilaHomologada[];
  foliosSolicitud: number;
  foliosCertificado: number;
  foliosContenidos: number | null;
  periodoMatricula: string;
  cursosMatricula: FilaCursoMatricula[];
  fechaLimitePago: string;
  coordinadorNombre: string;
  logoPath?: string;
  vigiladoPath?: string;
};

const styles = StyleSheet.create({
  pagina: {
    paddingTop: 45,
    paddingBottom: 55,
    paddingLeft: 60,
    paddingRight: 60,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: "#000000",
    lineHeight: 1.35,
  },
  logoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  logoImg: {
    width: 220,
    height: 48,
    objectFit: "contain",
  },
  vigiladoImg: {
    width: 14,
    height: 80,
    objectFit: "contain",
    position: "absolute",
    right: -35,
    top: 50,
  },
  headerContinuacion: {
    position: "absolute",
    top: 25,
    left: 60,
    right: 60,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#475569",
  },
  footerInstitucional: {
    position: "absolute",
    bottom: 20,
    left: 60,
    right: 60,
    fontSize: 6.8,
    color: "#475569",
    textAlign: "center",
    lineHeight: 1.25,
    borderTopWidth: 0.5,
    borderTopColor: "#94a3b8",
    paddingTop: 5,
  },
  tituloResolucion: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 4,
  },
  fechaEncabezado: {
    fontSize: 9.5,
    textAlign: "center",
    marginBottom: 6,
  },
  epigrafe: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "justify",
    marginBottom: 8,
    lineHeight: 1.28,
  },
  parrafoLegal: {
    fontSize: 9.5,
    textAlign: "justify",
    marginBottom: 6,
  },
  considerandoTitulo: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    marginTop: 6,
    marginBottom: 4,
  },
  resuelveTitulo: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 6,
  },
  articuloTitulo: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    marginTop: 8,
    marginBottom: 4,
  },
  tabla: {
    width: "100%",
    borderWidth: 0.5,
    borderColor: "#000000",
    marginTop: 6,
    marginBottom: 8,
  },
  tablaFila: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    minHeight: 18,
    alignItems: "stretch",
  },
  tablaFilaEncabezado: {
    backgroundColor: "#ffffff",
  },
  tablaFilaAzul: {
    flexDirection: "row",
    backgroundColor: "#002060",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ffffff",
    minHeight: 18,
    alignItems: "stretch",
  },
  tablaFilaAzulCierre: {
    flexDirection: "row",
    backgroundColor: "#002060",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    minHeight: 18,
    alignItems: "stretch",
  },
  celdaAzul: {
    justifyContent: "center",
    paddingVertical: 3.5,
    paddingHorizontal: 4,
    borderRightWidth: 0.5,
    borderRightColor: "#ffffff",
  },
  celdaAzulSinBorde: {
    justifyContent: "center",
    paddingVertical: 3.5,
    paddingHorizontal: 4,
  },
  celda: {
    borderRightWidth: 0.5,
    borderRightColor: "#000000",
    justifyContent: "center",
    paddingVertical: 3.5,
    paddingHorizontal: 3.5,
  },
  celdaSinBorde: {
    justifyContent: "center",
    paddingVertical: 3.5,
    paddingHorizontal: 3.5,
  },
  celdaCompacta: {
    borderRightWidth: 0.5,
    borderRightColor: "#000000",
    justifyContent: "center",
    paddingVertical: 3.5,
    paddingHorizontal: 2,
  },
  celdaCompactaSinBorde: {
    justifyContent: "center",
    paddingVertical: 3.5,
    paddingHorizontal: 2,
  },
  textoAzul: {
    fontSize: 7.5,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
  },
  textoEncabezado: {
    fontSize: 6.8,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.15,
  },
  textoDato: {
    fontSize: 7.5,
    lineHeight: 1.25,
  },
  textoBold: {
    fontFamily: "Helvetica-Bold",
  },
  textoCentro: {
    textAlign: "center",
  },
  textoDerecha: {
    textAlign: "right",
  },
  firmaBloque: {
    marginTop: 18,
    marginBottom: 10,
  },
  notificacionBloque: {
    marginTop: 10,
    fontSize: 8.5,
    lineHeight: 1.3,
  },
});

function DocumentoResolucion(datos: DatosResolucion) {
  const logoSrc = datos.logoPath || path.join(process.cwd(), "public/resolucion/logo-uniautonoma.png");
  const totalCreditosHomologados = datos.homologaciones.reduce(
    (acc, cur) => acc + (cur.creditos || 0),
    0,
  );
  const totalFolios =
    (datos.foliosSolicitud || 1) +
    (datos.foliosCertificado || 0) +
    (datos.foliosContenidos || 0);

  const totalCursosMatricula = datos.cursosMatricula.length;
  const totalCreditosMatricula = datos.cursosMatricula.reduce(
    (acc, cur) => acc + (cur.creditos || 0),
    0,
  );

  return (
    <Document
      title={`Resolución de Homologación · ${datos.solicitanteNombre}`}
      author="Corporación Universitaria Autónoma del Cauca"
    >
      <Page size="LETTER" style={styles.pagina}>
        {/* Encabezado dinámico para páginas de continuación (página 2 en adelante) */}
        <View style={styles.headerContinuacion} fixed>
          <Text
            render={({ pageNumber }) =>
              pageNumber > 1
                ? `Continuación Resolución No. ${datos.numeroResolucion || "XXX"} del ${datos.fechaResolucionEncabezado.replace(/[()]/g, "")}`
                : ""
            }
          />
          <Text
            render={({ pageNumber, totalPages }) =>
              pageNumber > 1 ? `Página ${pageNumber} de ${totalPages}` : ""
            }
          />
        </View>

        {/* Encabezado primera página: Logo institucional */}
        <View style={styles.logoContainer}>
          <Image src={logoSrc} style={styles.logoImg} />
        </View>

        {/* Título de la Resolución */}
        <Text style={styles.tituloResolucion}>
          RESOLUCIÓN No. {datos.numeroResolucion || "XXX"}
        </Text>
        <Text style={styles.fechaEncabezado}>
          {datos.fechaResolucionEncabezado}
        </Text>

        <Text style={styles.epigrafe}>
          POR LA CUAL SE APRUEBA EL ESTUDIO DE HOMOLOGACIÓN DE LOS CURSOS
          APROBADOS EN EL PROGRAMA, {datos.programaOrigen.toUpperCase()} DE LA{" "}
          {datos.institucionOrigen.toUpperCase()}, SOLICITADOS POR{" "}
          {datos.solicitanteNombre.toUpperCase()}, IDENTIFICADO CON CÉDULA DE
          CIUDADANÍA No. {datos.solicitanteCedula || "—"}{" "}
          {datos.solicitanteLugarExp ? `DE ${datos.solicitanteLugarExp.toUpperCase()}` : ""}.
        </Text>

        <Text style={styles.parrafoLegal}>
          El suscrito Vicerrector Académico de la CORPORACIÓN UNIVERSITARIA
          AUTÓNOMA DEL CAUCA, en uso de sus atribuciones reglamentarias en
          especial las conferidas en el artículo 22 del Acuerdo 006 de 2016 de los
          Estatutos institucionales y el artículo 57 del Acuerdo 005 de 2025. del
          Reglamento estudiantil, y
        </Text>

        <Text style={styles.considerandoTitulo}>CONSIDERANDO:</Text>

        <Text style={styles.parrafoLegal}>
          Que la Coordinación del Programa de {datos.carreraDestino} realizó el
          estudio de homologación de los cursos aprobados por{" "}
          {datos.solicitanteNombre.toUpperCase()}, identificado con CÉDULA DE
          CIUDADANÍA No. {datos.solicitanteCedula || "—"}{" "}
          {datos.solicitanteLugarExp ? `DE ${datos.solicitanteLugarExp.toUpperCase()}` : ""}, en
          la {datos.institucionOrigen.toUpperCase()};
        </Text>

        <Text style={styles.parrafoLegal}>
          Que el Vicerrector Académico revisó los procedimientos aplicados y los
          anexos allegados por {datos.solicitanteNombre.toUpperCase()}, para el
          estudio y análisis de la homologación realizada por la Coordinación del
          Programa {datos.carreraDestino}, con el correspondiente pensum vigente
          del Programa de {datos.carreraDestino} aprobado mediante Resolución{" "}
          {datos.resolucionMen || "expedida por el Ministerio de Educación Nacional"};
        </Text>

        <Text style={styles.parrafoLegal}>
          Que para los casos de corrección de errores de digitación numéricos o en
          nombres, el Código de procedimiento administrativo y de lo contencioso
          administrativo, Ley 1437 de 2011 prevé la expedición de nuevos actos
          administrativos, sin que ello altere el sentido material de la decisión
          o la reactivación de términos para ejercer la vía administrativa,
          decisión que deberá ser notificada al interesado;
        </Text>

        <Text style={styles.resuelveTitulo}>RESUELVE:</Text>

        <Text style={styles.parrafoLegal}>
          <Text style={styles.textoBold}>ARTICULO 1°.</Text> Aprobar el estudio de
          homologación presentado por {datos.solicitanteNombre.toUpperCase()},
          identificado con la cédula de ciudadanía No.{" "}
          {datos.solicitanteCedula || "—"}{" "}
          {datos.solicitanteLugarExp ? `DE ${datos.solicitanteLugarExp.toUpperCase()}` : ""}, de
          la siguiente manera:
        </Text>

        <Text style={{ fontSize: 8.5, marginBottom: 4 }}>
          Entiéndase: CR: Crédito Académico, IH: Intensidad Horaria: Tipo: T:
          Teórico, P: Práctico; TP: Teórico Práctico, NA: No Aplica.
        </Text>

        {/* TABLA ARTÍCULO 1°: Cursos homologados */}
        <View style={styles.tabla}>
          {/* Fila 1: Programa de origen */}
          <View style={styles.tablaFilaAzul}>
            <View style={[styles.celdaAzul, { width: "32.5%" }]}>
              <Text style={styles.textoAzul}>PROGRAMA DE ORIGEN:</Text>
            </View>
            <View style={[styles.celdaAzulSinBorde, { width: "67.5%" }]}>
              <Text style={styles.textoAzul}>{datos.programaOrigen.toUpperCase()}</Text>
            </View>
          </View>

          {/* Fila 2: Institución de origen */}
          <View style={styles.tablaFilaAzulCierre}>
            <View style={[styles.celdaAzul, { width: "32.5%" }]}>
              <Text style={styles.textoAzul}>INSTITUCIÓN DE ORIGEN:</Text>
            </View>
            <View style={[styles.celdaAzulSinBorde, { width: "67.5%" }]}>
              <Text style={styles.textoAzul}>{datos.institucionOrigen.toUpperCase()}</Text>
            </View>
          </View>

          {/* Fila 3: Banner de título */}
          <View style={[styles.tablaFila, { backgroundColor: "#ffffff" }]}>
            <View style={[styles.celdaSinBorde, { width: "100%", paddingVertical: 4 }]}>
              <Text style={[styles.textoBold, styles.textoCentro, { fontSize: 8.5 }]}>
                CURSOS ACADÉMICOS HOMOLOGADOS
              </Text>
            </View>
          </View>

          {/* Fila 4: Encabezados de columna */}
          <View style={[styles.tablaFila, styles.tablaFilaEncabezado]}>
            <View style={[styles.celda, { width: "25.4%" }]}>
              <Text style={[styles.textoEncabezado, styles.textoCentro]}>
                NOMBRE CURSO INSTITUCIÓN DE ORIGEN
              </Text>
            </View>
            <View style={[styles.celda, { width: "15.5%" }]}>
              <Text style={[styles.textoEncabezado, styles.textoCentro]}>
                CÓDIGO CURSO UNIAUTONOMA
              </Text>
            </View>
            <View style={[styles.celda, { width: "24.8%" }]}>
              <Text style={[styles.textoEncabezado, styles.textoCentro]}>
                NOMBRE CURSO ACADÉMICO UNIAUTONOMA
              </Text>
            </View>
            <View style={[styles.celdaCompacta, { width: "7.0%" }]}>
              <Text style={[styles.textoEncabezado, styles.textoCentro]}>SEM.</Text>
            </View>
            <View style={[styles.celdaCompacta, { width: "4.5%" }]}>
              <Text style={[styles.textoEncabezado, styles.textoCentro]}>CR</Text>
            </View>
            <View style={[styles.celdaCompacta, { width: "5.5%" }]}>
              <Text style={[styles.textoEncabezado, styles.textoCentro]}>IH</Text>
            </View>
            <View style={[styles.celdaCompacta, { width: "5.5%" }]}>
              <Text style={[styles.textoEncabezado, styles.textoCentro]}>TIPO</Text>
            </View>
            <View style={[styles.celdaSinBorde, { width: "11.8%" }]}>
              <Text style={[styles.textoEncabezado, styles.textoCentro]}>CALIFICACIÓN</Text>
            </View>
          </View>

          {/* Filas de datos homologados */}
          {datos.homologaciones.map((h, i) => (
            <View key={i} style={styles.tablaFila} wrap={false}>
              <View style={[styles.celda, { width: "25.4%" }]}>
                <Text style={styles.textoDato}>{formatearCursoCapitalizado(h.materiaOrigen)}</Text>
              </View>
              <View style={[styles.celda, { width: "15.5%" }]}>
                <Text style={[styles.textoDato, styles.textoCentro]}>
                  {h.codigoUniautonoma || "—"}
                </Text>
              </View>
              <View style={[styles.celda, { width: "24.8%" }]}>
                <Text style={styles.textoDato}>{h.nombreAsignatura}</Text>
              </View>
              <View style={[styles.celdaCompacta, { width: "7.0%" }]}>
                <Text style={[styles.textoDato, styles.textoCentro]}>{h.semestre || "—"}</Text>
              </View>
              <View style={[styles.celdaCompacta, { width: "4.5%" }]}>
                <Text style={[styles.textoDato, styles.textoCentro]}>{h.creditos || "—"}</Text>
              </View>
              <View style={[styles.celdaCompacta, { width: "5.5%" }]}>
                <Text style={[styles.textoDato, styles.textoCentro]}>
                  {h.intensidadHoraria || "—"}
                </Text>
              </View>
              <View style={[styles.celdaCompacta, { width: "5.5%" }]}>
                <Text style={[styles.textoDato, styles.textoCentro]}>{h.tipo || "TP"}</Text>
              </View>
              <View style={[styles.celdaSinBorde, { width: "11.8%" }]}>
                <Text style={[styles.textoDato, styles.textoCentro]}>
                  {h.calificacion || "Aprobado"}
                </Text>
              </View>
            </View>
          ))}

          {/* Totales Artículo 1° */}
          <View wrap={false}>
            <View style={styles.tablaFila}>
              <View style={[styles.celda, { width: "65.7%" }]}>
                <Text style={[styles.textoDato, styles.textoBold, styles.textoCentro]}>
                  TOTAL CURSOS HOMOLOGADOS:
                </Text>
              </View>
              <View style={[styles.celdaSinBorde, { width: "34.3%" }]}>
                <Text style={[styles.textoDato, styles.textoBold, styles.textoCentro]}>
                  {datos.homologaciones.length}
                </Text>
              </View>
            </View>
            <View style={styles.tablaFila}>
              <View style={[styles.celda, { width: "65.7%" }]}>
                <Text style={[styles.textoDato, styles.textoBold, styles.textoCentro]}>
                  TOTAL CRÉDITOS HOMOLOGADOS:
                </Text>
              </View>
              <View style={[styles.celdaSinBorde, { width: "34.3%" }]}>
                <Text style={[styles.textoDato, styles.textoBold, styles.textoCentro]}>
                  {totalCreditosHomologados}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ARTÍCULO 2°: Documentos analizados */}
        <Text style={styles.articuloTitulo}>
          ARTICULO 2°. Para realizar este estudio se analizaron los siguientes
          documentos, los cuales reposarán en la hoja de vida del
          aspirante/estudiante:
        </Text>

        <View style={styles.tabla}>
          <View style={styles.tablaFilaAzulCierre}>
            <View style={[styles.celdaAzul, { width: "80%" }]}>
              <Text style={styles.textoAzul}>DOCUMENTO</Text>
            </View>
            <View style={[styles.celdaAzulSinBorde, { width: "20%" }]}>
              <Text style={[styles.textoAzul, styles.textoCentro]}>N0. DE FOLIOS</Text>
            </View>
          </View>

          <View style={styles.tablaFila} wrap={false}>
            <View style={[styles.celda, { width: "80%" }]}>
              <Text style={styles.textoDato}>Formato de solicitud del aspirante/estudiante.</Text>
            </View>
            <View style={[styles.celdaSinBorde, { width: "20%" }]}>
              <Text style={[styles.textoDato, styles.textoCentro]}>
                {datos.foliosSolicitud || 1}
              </Text>
            </View>
          </View>

          <View style={styles.tablaFila} wrap={false}>
            <View style={[styles.celda, { width: "80%" }]}>
              <Text style={styles.textoDato}>
                Certificado oficial de calificaciones, en el cual deben figurar todas
                las asignaturas cursadas por estudiantes, la intensidad horaria
                total, los créditos académicos y la calificación de cada una de
                ellas.
              </Text>
            </View>
            <View style={[styles.celdaSinBorde, { width: "20%" }]}>
              <Text style={[styles.textoDato, styles.textoCentro]}>
                {datos.foliosCertificado || "—"}
              </Text>
            </View>
          </View>

          <View style={styles.tablaFila} wrap={false}>
            <View style={[styles.celda, { width: "80%" }]}>
              <Text style={styles.textoDato}>
                Documento debidamente refrendado en donde conste el contenido
                programático de las asignaturas cursadas y aprobadas.
              </Text>
            </View>
            <View style={[styles.celdaSinBorde, { width: "20%" }]}>
              <Text style={[styles.textoDato, styles.textoCentro]}>
                {datos.foliosContenidos ? datos.foliosContenidos : "—"}
              </Text>
            </View>
          </View>

          <View style={styles.tablaFila} wrap={false}>
            <View style={[styles.celda, { width: "80%" }]}>
              <Text style={[styles.textoDato, styles.textoBold]}>TOTAL FOLIOS</Text>
            </View>
            <View style={[styles.celdaSinBorde, { width: "20%" }]}>
              <Text style={[styles.textoDato, styles.textoBold, styles.textoCentro]}>
                {totalFolios}
              </Text>
            </View>
          </View>
        </View>

        {/* ARTÍCULO 3°: Cursos para el primer período */}
        <Text style={styles.articuloTitulo}>
          ARTICULO 3°. Se proyecta la matrícula de los siguientes cursos para el
          primer período académico de {datos.periodoMatricula || "2026 (1P-2026)"}:
        </Text>

        <View style={styles.tabla}>
          <View style={styles.tablaFilaAzulCierre}>
            <View style={[styles.celdaAzul, { width: "6%" }]}>
              <Text style={[styles.textoAzul, styles.textoCentro]}>NO</Text>
            </View>
            <View style={[styles.celdaAzul, { width: "18%" }]}>
              <Text style={[styles.textoAzul, styles.textoCentro]}>CÓDIGO DEL CURSO</Text>
            </View>
            <View style={[styles.celdaAzul, { width: "44%" }]}>
              <Text style={[styles.textoAzul, styles.textoCentro]}>CURSO</Text>
            </View>
            <View style={[styles.celdaAzul, { width: "8%" }]}>
              <Text style={[styles.textoAzul, styles.textoCentro]}>SEM.</Text>
            </View>
            <View style={[styles.celdaAzul, { width: "8%" }]}>
              <Text style={[styles.textoAzul, styles.textoCentro]}>CR</Text>
            </View>
            <View style={[styles.celdaAzul, { width: "8%" }]}>
              <Text style={[styles.textoAzul, styles.textoCentro]}>IH</Text>
            </View>
            <View style={[styles.celdaAzulSinBorde, { width: "8%" }]}>
              <Text style={[styles.textoAzul, styles.textoCentro]}>TP</Text>
            </View>
          </View>

          {datos.cursosMatricula.map((c, i) => (
            <View key={i} style={styles.tablaFila} wrap={false}>
              <View style={[styles.celdaCompacta, { width: "6%" }]}>
                <Text style={[styles.textoDato, styles.textoCentro]}>{c.no || i + 1}</Text>
              </View>
              <View style={[styles.celda, { width: "18%" }]}>
                <Text style={[styles.textoDato, styles.textoCentro]}>{c.codigo || "—"}</Text>
              </View>
              <View style={[styles.celda, { width: "44%" }]}>
                <Text style={styles.textoDato}>{c.curso}</Text>
              </View>
              <View style={[styles.celdaCompacta, { width: "8%" }]}>
                <Text style={[styles.textoDato, styles.textoCentro]}>{c.semestre || "—"}</Text>
              </View>
              <View style={[styles.celdaCompacta, { width: "8%" }]}>
                <Text style={[styles.textoDato, styles.textoCentro]}>{c.creditos || "—"}</Text>
              </View>
              <View style={[styles.celdaCompacta, { width: "8%" }]}>
                <Text style={[styles.textoDato, styles.textoCentro]}>{c.intensidadHoraria || "—"}</Text>
              </View>
              <View style={[styles.celdaCompactaSinBorde, { width: "8%" }]}>
                <Text style={[styles.textoDato, styles.textoCentro]}>{c.tipo || "TP"}</Text>
              </View>
            </View>
          ))}

          <View wrap={false}>
            <View style={styles.tablaFila}>
              <View style={[styles.celda, { width: "68%" }]}>
                <Text style={[styles.textoDato, styles.textoBold]}>TOTAL CURSOS</Text>
              </View>
              <View style={[styles.celdaSinBorde, { width: "32%" }]}>
                <Text style={[styles.textoDato, styles.textoBold, styles.textoCentro]}>
                  {totalCursosMatricula}
                </Text>
              </View>
            </View>
            <View style={styles.tablaFila}>
              <View style={[styles.celda, { width: "68%" }]}>
                <Text style={[styles.textoDato, styles.textoBold]}>TOTAL CREDITOS</Text>
              </View>
              <View style={[styles.celdaSinBorde, { width: "32%" }]}>
                <Text style={[styles.textoDato, styles.textoBold, styles.textoCentro]}>
                  {totalCreditosMatricula}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* PARÁGRAFOS Y CIERRE */}
        <Text style={styles.parrafoLegal}>
          <Text style={styles.textoBold}>PARÁGRAFO 1.</Text> Para legalizar el
          proceso de matrícula tanto académica como financiera, deberá cancelar
          los derechos pecuniarios correspondientes antes del{" "}
          {datos.fechaLimitePago || "fijado en el calendario institucional"}.
        </Text>

        <Text style={styles.parrafoLegal}>
          <Text style={styles.textoBold}>PARÁGRAFO 2.</Text> El aspirante/estudiante
          tendrá derecho a solicitar la revisión del estudio, para lo cual tendrá
          un plazo máximo de ocho (8) días calendario siguientes a su
          notificación, siempre y cuando esta revisión se refiera a la
          documentación entregada inicialmente. Cuando el aspirante/estudiante
          desee incorporar nuevos contenidos, se debe solicitar y realizar un
          nuevo estudio de homologación.
        </Text>

        <Text style={styles.parrafoLegal}>
          <Text style={styles.textoBold}>ARTICULO 3°.</Text> La presente
          resolución rige a partir de la fecha de su expedición.
        </Text>

        <View wrap={false}>
          <Text style={[styles.textoBold, styles.textoCentro, { marginTop: 10, marginBottom: 4 }]}>
            NOTIFIQUESE Y CUMPLASE
          </Text>

          <Text style={[styles.textoCentro, { marginBottom: 20 }]}>
            {datos.fechaLegalCierre}
          </Text>

          <View style={styles.firmaBloque}>
            <Text style={[styles.textoBold, styles.textoCentro]}>
              SEBASTIÁN TORO VÉLEZ Ph.D.(c)
            </Text>
            <Text style={styles.textoCentro}>Vicerrector Académico</Text>
          </View>

          <View style={styles.notificacionBloque}>
            <Text style={styles.textoBold}>Notificada(o):</Text>
            <Text>{datos.solicitanteNombre}</Text>
            <Text>
              Cédula de ciudadanía No. {datos.solicitanteCedula || "—"}{" "}
              {datos.solicitanteLugarExp ? `DE ${datos.solicitanteLugarExp.toUpperCase()}` : ""}
            </Text>
            <Text>Fecha de notificación: {datos.fechaNotificacion}</Text>
            <Text style={{ marginTop: 4 }}>
              Copia: Oficina de mercadeo y admisiones
            </Text>
            <Text>Gestión documental</Text>
            <Text>Oficina control y registro académico</Text>
            <Text style={{ marginTop: 4 }}>
              Elaboró: {datos.coordinadorNombre || "Coordinación de Programa"}
            </Text>
            <Text>Revisó: Saide López.</Text>
          </View>
        </View>

        {/* Pie de página institucional en cada hoja */}
        <View style={styles.footerInstitucional} fixed>
          <Text>
            NIT: 891.501.766-6 Lic. De Funcionamiento: 1232 de 1979. Resolución
            MEN Nº. 677 de 2003. Código SNIES: 2849
          </Text>
          <Text>
            Sede principal Calle 5 3-85 Barrio Centro. PBX: 602 8222295 –
            WhatsApp 314 639 54 95 – 320 675 04 64 A.A. 043 Popayán - Cauca -
            Colombia.
          </Text>
          <Text>
            www.uniautonoma.edu.co - Email: recepcion@uniautonoma.edu.co
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export function generarActaPdf(datos: DatosResolucion): Promise<Buffer> {
  return renderToBuffer(<DocumentoResolucion {...datos} />);
}
