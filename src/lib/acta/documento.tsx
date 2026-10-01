import React from "react";
import path from "node:path";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

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
    marginBottom: 15,
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
    marginTop: 6,
  },
  fechaEncabezado: {
    fontSize: 9.5,
    textAlign: "center",
    marginBottom: 8,
  },
  epigrafe: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "justify",
    marginBottom: 12,
    lineHeight: 1.3,
  },
  parrafoLegal: {
    fontSize: 9.5,
    textAlign: "justify",
    marginBottom: 8,
  },
  considerandoTitulo: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    marginTop: 8,
    marginBottom: 6,
  },
  resuelveTitulo: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  articuloTitulo: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
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
    alignItems: "center",
  },
  tablaFilaEncabezado: {
    backgroundColor: "#f1f5f9",
    fontFamily: "Helvetica-Bold",
  },
  tablaCelda: {
    paddingVertical: 3,
    paddingHorizontal: 3,
    fontSize: 7.5,
    borderRightWidth: 0.5,
    borderRightColor: "#000000",
  },
  tablaCeldaSinBorde: {
    paddingVertical: 3,
    paddingHorizontal: 3,
    fontSize: 7.5,
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
    marginTop: 25,
    marginBottom: 15,
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
          <View style={styles.tablaFila}>
            <Text style={[styles.tablaCelda, styles.textoBold, { width: "30%" }]}>
              PROGRAMA DE ORIGEN:
            </Text>
            <Text style={[styles.tablaCeldaSinBorde, { width: "70%" }]}>
              {datos.programaOrigen.toUpperCase()}
            </Text>
          </View>

          {/* Fila 2: Institución de origen */}
          <View style={styles.tablaFila}>
            <Text style={[styles.tablaCelda, styles.textoBold, { width: "30%" }]}>
              INSTITUCIÓN DE ORIGEN:
            </Text>
            <Text style={[styles.tablaCeldaSinBorde, { width: "70%" }]}>
              {datos.institucionOrigen.toUpperCase()}
            </Text>
          </View>

          {/* Fila 3: Banner de título */}
          <View style={[styles.tablaFila, styles.tablaFilaEncabezado]}>
            <Text
              style={[
                styles.tablaCeldaSinBorde,
                styles.textoBold,
                styles.textoCentro,
                { width: "100%", fontSize: 8 },
              ]}
            >
              CURSOS ACADÉMICOS HOMOLOGADOS
            </Text>
          </View>

          {/* Fila 4: Encabezados de columna */}
          <View style={[styles.tablaFila, styles.tablaFilaEncabezado]}>
            <Text style={[styles.tablaCelda, styles.textoBold, styles.textoCentro, { width: "26%" }]}>
              NOMBRE CURSO INSTITUCIÓN DE ORIGEN
            </Text>
            <Text style={[styles.tablaCelda, styles.textoBold, styles.textoCentro, { width: "12%" }]}>
              CÓDIGO CURSO UNIAUTONOMA
            </Text>
            <Text style={[styles.tablaCelda, styles.textoBold, styles.textoCentro, { width: "26%" }]}>
              NOMBRE CURSO ACADÉMICO UNIAUTONOMA
            </Text>
            <Text style={[styles.tablaCelda, styles.textoBold, styles.textoCentro, { width: "6%" }]}>
              SEM.
            </Text>
            <Text style={[styles.tablaCelda, styles.textoBold, styles.textoCentro, { width: "6%" }]}>
              CR
            </Text>
            <Text style={[styles.tablaCelda, styles.textoBold, styles.textoCentro, { width: "7%" }]}>
              IH
            </Text>
            <Text style={[styles.tablaCelda, styles.textoBold, styles.textoCentro, { width: "6%" }]}>
              TIPO
            </Text>
            <Text style={[styles.tablaCeldaSinBorde, styles.textoBold, styles.textoCentro, { width: "11%" }]}>
              CALIFICACIÓN
            </Text>
          </View>

          {/* Filas de datos homologados */}
          {datos.homologaciones.map((h, i) => (
            <View key={i} style={styles.tablaFila} wrap={false}>
              <Text style={[styles.tablaCelda, { width: "26%" }]}>{h.materiaOrigen}</Text>
              <Text style={[styles.tablaCelda, styles.textoCentro, { width: "12%" }]}>
                {h.codigoUniautonoma || "—"}
              </Text>
              <Text style={[styles.tablaCelda, { width: "26%" }]}>{h.nombreAsignatura}</Text>
              <Text style={[styles.tablaCelda, styles.textoCentro, { width: "6%" }]}>
                {h.semestre || "—"}
              </Text>
              <Text style={[styles.tablaCelda, styles.textoCentro, { width: "6%" }]}>
                {h.creditos || "—"}
              </Text>
              <Text style={[styles.tablaCelda, styles.textoCentro, { width: "7%" }]}>
                {h.intensidadHoraria || "—"}
              </Text>
              <Text style={[styles.tablaCelda, styles.textoCentro, { width: "6%" }]}>
                {h.tipo || "TP"}
              </Text>
              <Text style={[styles.tablaCeldaSinBorde, styles.textoCentro, { width: "11%" }]}>
                {h.calificacion || "Aprobado"}
              </Text>
            </View>
          ))}

          {/* Totales Artículo 1° */}
          <View style={[styles.tablaFila, styles.tablaFilaEncabezado]} wrap={false}>
            <Text style={[styles.tablaCelda, styles.textoBold, { width: "64%" }]}>
              TOTAL CURSOS HOMOLOGADOS:
            </Text>
            <Text style={[styles.tablaCeldaSinBorde, styles.textoBold, styles.textoCentro, { width: "36%" }]}>
              {datos.homologaciones.length}
            </Text>
          </View>
          <View style={[styles.tablaFila, styles.tablaFilaEncabezado]} wrap={false}>
            <Text style={[styles.tablaCelda, styles.textoBold, { width: "64%" }]}>
              TOTAL CRÉDITOS HOMOLOGADOS:
            </Text>
            <Text style={[styles.tablaCeldaSinBorde, styles.textoBold, styles.textoCentro, { width: "36%" }]}>
              {totalCreditosHomologados}
            </Text>
          </View>
        </View>

        {/* ARTÍCULO 2°: Documentos analizados */}
        <Text style={styles.articuloTitulo}>
          ARTICULO 2°. Para realizar este estudio se analizaron los siguientes
          documentos, los cuales reposarán en la hoja de vida del
          aspirante/estudiante:
        </Text>

        <View style={styles.tabla}>
          <View style={[styles.tablaFila, styles.tablaFilaEncabezado]}>
            <Text style={[styles.tablaCelda, styles.textoBold, { width: "80%" }]}>
              DOCUMENTO
            </Text>
            <Text style={[styles.tablaCeldaSinBorde, styles.textoBold, styles.textoCentro, { width: "20%" }]}>
              N0. DE FOLIOS
            </Text>
          </View>

          <View style={styles.tablaFila} wrap={false}>
            <Text style={[styles.tablaCelda, { width: "80%" }]}>
              Formato de solicitud del aspirante/estudiante.
            </Text>
            <Text style={[styles.tablaCeldaSinBorde, styles.textoCentro, { width: "20%" }]}>
              {datos.foliosSolicitud || 1}
            </Text>
          </View>

          <View style={styles.tablaFila} wrap={false}>
            <Text style={[styles.tablaCelda, { width: "80%" }]}>
              Certificado oficial de calificaciones, en el cual deben figurar todas
              las asignaturas cursadas por estudiantes, la intensidad horaria
              total, los créditos académicos y la calificación de cada una de
              ellas.
            </Text>
            <Text style={[styles.tablaCeldaSinBorde, styles.textoCentro, { width: "20%" }]}>
              {datos.foliosCertificado || "—"}
            </Text>
          </View>

          <View style={styles.tablaFila} wrap={false}>
            <Text style={[styles.tablaCelda, { width: "80%" }]}>
              Documento debidamente refrendado en donde conste el contenido
              programático de las asignaturas cursadas y aprobadas.
            </Text>
            <Text style={[styles.tablaCeldaSinBorde, styles.textoCentro, { width: "20%" }]}>
              {datos.foliosContenidos ? datos.foliosContenidos : "—"}
            </Text>
          </View>

          <View style={[styles.tablaFila, styles.tablaFilaEncabezado]} wrap={false}>
            <Text style={[styles.tablaCelda, styles.textoBold, { width: "80%" }]}>
              TOTAL FOLIOS
            </Text>
            <Text style={[styles.tablaCeldaSinBorde, styles.textoBold, styles.textoCentro, { width: "20%" }]}>
              {totalFolios}
            </Text>
          </View>
        </View>

        {/* ARTÍCULO 3°: Cursos para el primer período */}
        <Text style={styles.articuloTitulo}>
          ARTICULO 3°. Se proyecta la matrícula de los siguientes cursos para el
          primer período académico de {datos.periodoMatricula || "2026 (1P-2026)"}:
        </Text>

        <View style={styles.tabla}>
          <View style={[styles.tablaFila, styles.tablaFilaEncabezado]}>
            <Text style={[styles.tablaCelda, styles.textoBold, styles.textoCentro, { width: "6%" }]}>
              NO
            </Text>
            <Text style={[styles.tablaCelda, styles.textoBold, styles.textoCentro, { width: "18%" }]}>
              CÓDIGO DEL CURSO
            </Text>
            <Text style={[styles.tablaCelda, styles.textoBold, styles.textoCentro, { width: "44%" }]}>
              CURSO
            </Text>
            <Text style={[styles.tablaCelda, styles.textoBold, styles.textoCentro, { width: "8%" }]}>
              SEM.
            </Text>
            <Text style={[styles.tablaCelda, styles.textoBold, styles.textoCentro, { width: "8%" }]}>
              CR
            </Text>
            <Text style={[styles.tablaCelda, styles.textoBold, styles.textoCentro, { width: "8%" }]}>
              IH
            </Text>
            <Text style={[styles.tablaCeldaSinBorde, styles.textoBold, styles.textoCentro, { width: "8%" }]}>
              TP
            </Text>
          </View>

          {datos.cursosMatricula.map((c, i) => (
            <View key={i} style={styles.tablaFila} wrap={false}>
              <Text style={[styles.tablaCelda, styles.textoCentro, { width: "6%" }]}>
                {c.no || i + 1}
              </Text>
              <Text style={[styles.tablaCelda, styles.textoCentro, { width: "18%" }]}>
                {c.codigo || "—"}
              </Text>
              <Text style={[styles.tablaCelda, { width: "44%" }]}>{c.curso}</Text>
              <Text style={[styles.tablaCelda, styles.textoCentro, { width: "8%" }]}>
                {c.semestre || "—"}
              </Text>
              <Text style={[styles.tablaCelda, styles.textoCentro, { width: "8%" }]}>
                {c.creditos || "—"}
              </Text>
              <Text style={[styles.tablaCelda, styles.textoCentro, { width: "8%" }]}>
                {c.intensidadHoraria || "—"}
              </Text>
              <Text style={[styles.tablaCeldaSinBorde, styles.textoCentro, { width: "8%" }]}>
                {c.tipo || "TP"}
              </Text>
            </View>
          ))}

          <View style={[styles.tablaFila, styles.tablaFilaEncabezado]} wrap={false}>
            <Text style={[styles.tablaCelda, styles.textoBold, { width: "68%" }]}>
              TOTAL CURSOS
            </Text>
            <Text style={[styles.tablaCeldaSinBorde, styles.textoBold, styles.textoCentro, { width: "32%" }]}>
              {totalCursosMatricula}
            </Text>
          </View>
          <View style={[styles.tablaFila, styles.tablaFilaEncabezado]} wrap={false}>
            <Text style={[styles.tablaCelda, styles.textoBold, { width: "68%" }]}>
              TOTAL CREDITOS
            </Text>
            <Text style={[styles.tablaCeldaSinBorde, styles.textoBold, styles.textoCentro, { width: "32%" }]}>
              {totalCreditosMatricula}
            </Text>
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

        <Text style={[styles.textoBold, styles.textoCentro, { marginTop: 12, marginBottom: 4 }]}>
          NOTIFIQUESE Y CUMPLASE
        </Text>

        <Text style={[styles.textoCentro, { marginBottom: 30 }]}>
          {datos.fechaLegalCierre}
        </Text>

        <View style={styles.firmaBloque} wrap={false}>
          <Text style={[styles.textoBold, styles.textoCentro]}>
            SEBASTIÁN TORO VÉLEZ Ph.D.(c)
          </Text>
          <Text style={styles.textoCentro}>Vicerrector Académico</Text>
        </View>

        <View style={styles.notificacionBloque} wrap={false}>
          <Text style={styles.textoBold}>Notificada(o):</Text>
          <Text>{datos.solicitanteNombre}</Text>
          <Text>
            Cédula de ciudadanía No. {datos.solicitanteCedula || "—"}{" "}
            {datos.solicitanteLugarExp ? `DE ${datos.solicitanteLugarExp.toUpperCase()}` : ""}
          </Text>
          <Text>Fecha de notificación: {datos.fechaNotificacion}</Text>
          <Text style={{ marginTop: 6 }}>
            Copia: Oficina de mercadeo y admisiones
          </Text>
          <Text>Gestión documental</Text>
          <Text>Oficina control y registro académico</Text>
          <Text style={{ marginTop: 6 }}>
            Elaboró: {datos.coordinadorNombre || "Coordinación de Programa"}
          </Text>
          <Text>Revisó: Saide López.</Text>
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
