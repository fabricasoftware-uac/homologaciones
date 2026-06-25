import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

// Acta de homologación en PDF: el entregable formal que recibe el estudiante cuando su caso queda
// APROBADO. Se genera bajo demanda (no se almacena) desde las rutas /casos/[id]/acta (admin) y
// /seguimiento/[token]/acta (estudiante). Usa @react-pdf/renderer, que trae su propio motor de
// layout, por eso está externalizado en next.config.mjs.

export type FilaActa = {
  materia: string;
  asignatura: string;
  creditos: number;
};

export type DatosActa = {
  institucion: string; // marca (universidad de destino)
  marcaColor: string; // color de acento del acta
  folio: string; // identificador del caso (token corto)
  fecha: string; // fecha de emisión legible
  solicitante: string;
  institucionOrigen: string;
  carrera: string;
  semestre: number | null;
  nota: string | null;
  homologaciones: FilaActa[];
  // QR (data URL PNG) + URL legible para verificar la autenticidad del acta. Opcionales.
  qr: string | null;
  urlVerificacion: string | null;
};

function crearEstilos(acento: string) {
  return StyleSheet.create({
    pagina: {
      paddingTop: 48,
      paddingBottom: 56,
      paddingHorizontal: 48,
      fontSize: 10,
      fontFamily: "Helvetica",
      color: "#0f172a",
    },
    barra: { height: 6, backgroundColor: acento, marginBottom: 20, borderRadius: 2 },
    institucion: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#0f172a" },
    titulo: {
      fontSize: 13,
      fontFamily: "Helvetica-Bold",
      color: acento,
      marginTop: 2,
      letterSpacing: 1,
    },
    metaFila: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
    metaTexto: { fontSize: 9, color: "#64748b" },
    intro: { marginTop: 22, fontSize: 10, lineHeight: 1.5, color: "#334155" },
    negrita: { fontFamily: "Helvetica-Bold", color: "#0f172a" },
    seccionTitulo: {
      marginTop: 22,
      marginBottom: 8,
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      color: "#64748b",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    datosCaja: {
      backgroundColor: "#f8fafc",
      borderWidth: 1,
      borderColor: "#e2e8f0",
      borderRadius: 6,
      padding: 12,
    },
    datoFila: { flexDirection: "row", marginBottom: 4 },
    datoEtiqueta: { width: 130, color: "#64748b" },
    datoValor: { flex: 1, fontFamily: "Helvetica-Bold", color: "#0f172a" },
    tablaEncabezado: {
      flexDirection: "row",
      backgroundColor: acento,
      color: "#ffffff",
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
    },
    th: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#ffffff" },
    fila: {
      flexDirection: "row",
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: "#e2e8f0",
    },
    filaPar: { backgroundColor: "#f8fafc" },
    celda: { fontSize: 9.5, color: "#334155" },
    colMateria: { width: "44%", paddingRight: 6 },
    colAsignatura: { width: "44%", paddingRight: 6 },
    colCreditos: { width: "12%", textAlign: "right" },
    totalFila: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: "#cbd5e1",
    },
    semestreCaja: {
      marginTop: 18,
      padding: 12,
      backgroundColor: "#f0fdf4",
      borderWidth: 1,
      borderColor: "#bbf7d0",
      borderRadius: 6,
      color: "#166534",
      fontSize: 11,
    },
    notaCaja: {
      marginTop: 16,
      padding: 12,
      backgroundColor: "#fffbeb",
      borderWidth: 1,
      borderColor: "#fde68a",
      borderRadius: 6,
      color: "#78350f",
      fontSize: 9.5,
      lineHeight: 1.5,
    },
    verificacion: {
      marginTop: 22,
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderWidth: 1,
      borderColor: "#e2e8f0",
      borderRadius: 6,
      backgroundColor: "#f8fafc",
    },
    qrImg: { width: 64, height: 64, marginRight: 12 },
    verifTitulo: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 2 },
    verifTexto: { fontSize: 8, color: "#64748b", lineHeight: 1.4 },
    pie: {
      position: "absolute",
      bottom: 28,
      left: 48,
      right: 48,
      fontSize: 8,
      color: "#94a3b8",
      textAlign: "center",
      borderTopWidth: 1,
      borderTopColor: "#e2e8f0",
      paddingTop: 8,
    },
  });
}

function DocumentoActa(datos: DatosActa) {
  const s = crearEstilos(datos.marcaColor);
  const totalCreditos = datos.homologaciones.reduce((suma, h) => suma + (h.creditos || 0), 0);

  return (
    <Document
      title={`Acta de homologación · ${datos.solicitante}`}
      author={datos.institucion}
    >
      <Page size="A4" style={s.pagina}>
        <View style={s.barra} />

        <Text style={s.institucion}>{datos.institucion}</Text>
        <Text style={s.titulo}>ACTA DE HOMOLOGACIÓN</Text>
        <View style={s.metaFila}>
          <Text style={s.metaTexto}>Folio: {datos.folio}</Text>
          <Text style={s.metaTexto}>Fecha de emisión: {datos.fecha}</Text>
        </View>

        <Text style={s.intro}>
          Se hace constar que, una vez estudiado el historial académico presentado por{" "}
          <Text style={s.negrita}>{datos.solicitante}</Text>, proveniente de{" "}
          <Text style={s.negrita}>{datos.institucionOrigen}</Text>, se aprueba la homologación de las
          asignaturas que se relacionan a continuación dentro del programa de{" "}
          <Text style={s.negrita}>{datos.carrera}</Text>.
        </Text>

        <Text style={s.seccionTitulo}>Datos del solicitante</Text>
        <View style={s.datosCaja}>
          <View style={s.datoFila}>
            <Text style={s.datoEtiqueta}>Nombre</Text>
            <Text style={s.datoValor}>{datos.solicitante}</Text>
          </View>
          <View style={s.datoFila}>
            <Text style={s.datoEtiqueta}>Institución de origen</Text>
            <Text style={s.datoValor}>{datos.institucionOrigen}</Text>
          </View>
          <View style={[s.datoFila, { marginBottom: 0 }]}>
            <Text style={s.datoEtiqueta}>Programa de destino</Text>
            <Text style={s.datoValor}>{datos.carrera}</Text>
          </View>
        </View>

        <Text style={s.seccionTitulo}>
          Asignaturas homologadas ({datos.homologaciones.length})
        </Text>
        <View>
          <View style={s.tablaEncabezado}>
            <Text style={[s.th, s.colMateria]}>Materia cursada (origen)</Text>
            <Text style={[s.th, s.colAsignatura]}>Asignatura homologada</Text>
            <Text style={[s.th, s.colCreditos]}>Créd.</Text>
          </View>
          {datos.homologaciones.map((h, i) => (
            <View key={i} style={i % 2 === 1 ? [s.fila, s.filaPar] : s.fila} wrap={false}>
              <Text style={[s.celda, s.colMateria]}>{h.materia}</Text>
              <Text style={[s.celda, s.colAsignatura]}>{h.asignatura}</Text>
              <Text style={[s.celda, s.colCreditos]}>{h.creditos || "—"}</Text>
            </View>
          ))}
        </View>
        <View style={s.totalFila}>
          <Text style={[s.celda, s.negrita]}>Total de créditos homologados</Text>
          <Text style={[s.celda, s.negrita]}>{totalCreditos}</Text>
        </View>

        {datos.semestre != null && (
          <View style={s.semestreCaja}>
            <Text>
              Con base en lo homologado, el estudiante ingresa al{" "}
              <Text style={{ fontFamily: "Helvetica-Bold" }}>semestre {datos.semestre}</Text> del
              programa.
            </Text>
          </View>
        )}

        {datos.nota ? (
          <View style={s.notaCaja}>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>Observaciones</Text>
            <Text>{datos.nota}</Text>
          </View>
        ) : null}

        {datos.qr ? (
          <View style={s.verificacion} wrap={false}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={datos.qr} style={s.qrImg} />
            <View style={{ flex: 1 }}>
              <Text style={s.verifTitulo}>Verificación de autenticidad</Text>
              <Text style={s.verifTexto}>
                Escanea el código QR para confirmar que esta acta es auténtica
                {datos.urlVerificacion ? ", o visita:" : "."}
              </Text>
              {datos.urlVerificacion ? (
                <Text style={[s.verifTexto, { color: datos.marcaColor }]}>{datos.urlVerificacion}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <Text style={s.pie} fixed>
          Documento generado automáticamente por el sistema de homologaciones de {datos.institucion}.
          Este resultado es válido como constancia del estudio realizado.
        </Text>
      </Page>
    </Document>
  );
}

// Renderiza el acta a un Buffer listo para responder como PDF.
export function generarActaPdf(datos: DatosActa): Promise<Buffer> {
  return renderToBuffer(<DocumentoActa {...datos} />);
}
