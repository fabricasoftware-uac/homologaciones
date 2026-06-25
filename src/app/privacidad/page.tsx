import Link from "next/link";
import type { Metadata } from "next";
import {
  IconChevronLeft as ChevronLeft,
  IconShieldLock as ShieldLock,
  IconClipboardList as ClipboardList,
  IconLock as Lock,
  IconUserCheck as UserCheck,
  IconMail as Mail,
} from "@tabler/icons-react";

import { obtenerConfiguracion } from "@/lib/marca/configuracion";
import { Logotipo } from "@/components/logotipo";

export const metadata: Metadata = {
  title: "Política de tratamiento de datos",
};

// Política de tratamiento de datos personales (Habeas Data — Ley 1581 de 2012 y Decreto 1377 de
// 2013). Es una ruta PÚBLICA (fuera del grupo (app), declarada en RUTAS_PUBLICAS): el invitado debe
// poder leerla antes de autorizar el envío. Se parametriza con el nombre de la institución para que
// el white-label la mantenga consistente.
//
// NOTA PARA LA INSTITUCIÓN: completar los datos del responsable (razón social, NIT, dirección y
// correo de contacto del área de protección de datos) según corresponda al despliegue real.

const ACTUALIZADO = "23 de junio de 2026";

export default async function PaginaPrivacidad() {
  const cfg = await obtenerConfiguracion();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link
            href="/homologar"
            className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 shrink-0"
            aria-label="Volver"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <Logotipo marca={cfg} size="sm" />
          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{cfg.nombre}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-10 h-10 rounded-xl bg-marca/10 text-marca flex items-center justify-center shrink-0">
            <ShieldLock className="w-5 h-5" />
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Política de tratamiento de datos personales
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          Última actualización: {ACTUALIZADO} · Conforme a la Ley 1581 de 2012 y el Decreto 1377 de
          2013 (Colombia).
        </p>

        <div className="space-y-6">
          <Seccion icono={UserCheck} titulo="1. Responsable del tratamiento">
            <p>
              {cfg.nombre} (en adelante, “la institución”) es responsable del tratamiento de los
              datos personales que usted suministra a través de este formulario de homologación. Al
              enviar su solicitud, usted autoriza de manera previa, expresa e informada el
              tratamiento de sus datos en los términos de esta política.
            </p>
          </Seccion>

          <Seccion icono={ClipboardList} titulo="2. Datos que recolectamos">
            <p>Para estudiar su solicitud de homologación recolectamos:</p>
            <ul className="mt-2 space-y-1.5 list-disc list-inside marker:text-marca">
              <li>Datos de contacto: nombre completo, número de celular y correo electrónico.</li>
              <li>Institución de origen y programa académico de destino.</li>
              <li>
                Su certificado de notas o historial académico en PDF, y las asignaturas, créditos y
                calificaciones que contiene.
              </li>
            </ul>
          </Seccion>

          <Seccion icono={ClipboardList} titulo="3. Finalidad del tratamiento">
            <p>Sus datos se utilizan únicamente para:</p>
            <ul className="mt-2 space-y-1.5 list-disc list-inside marker:text-marca">
              <li>Analizar su historial académico y proponer la homologación de asignaturas.</li>
              <li>Contactarlo para informarle el resultado y confirmar el proceso.</li>
              <li>Llevar el control interno y estadístico de las solicitudes recibidas.</li>
            </ul>
            <p className="mt-3">
              No vendemos, alquilamos ni compartimos sus datos con terceros con fines comerciales.
            </p>
          </Seccion>

          <Seccion icono={UserCheck} titulo="4. Sus derechos como titular">
            <p>
              En cualquier momento usted puede conocer, actualizar y rectificar sus datos; solicitar
              prueba de la autorización otorgada; ser informado sobre el uso dado a sus datos;
              presentar quejas ante la Superintendencia de Industria y Comercio; revocar la
              autorización y solicitar la supresión de sus datos cuando no exista un deber legal de
              conservarlos.
            </p>
          </Seccion>

          <Seccion icono={Lock} titulo="5. Seguridad y conservación">
            <p>
              Su certificado se almacena de forma privada y solo es accesible para el personal
              autorizado que revisa su caso. Conservamos sus datos durante el tiempo necesario para
              atender su solicitud y cumplir las obligaciones legales aplicables; luego se eliminan o
              anonimizan.
            </p>
          </Seccion>

          <Seccion icono={Mail} titulo="6. Cómo ejercer sus derechos">
            <p>
              Para ejercer cualquiera de sus derechos, o para consultas sobre esta política, puede
              comunicarse con {cfg.nombre} a través de sus canales oficiales de atención. Atenderemos
              su solicitud en los términos y plazos que establece la ley.
            </p>
          </Seccion>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800">
          <Link
            href="/homologar"
            className="inline-flex items-center gap-2 text-sm font-semibold text-marca hover:gap-2.5 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver al formulario de homologación
          </Link>
        </div>
      </main>
    </div>
  );
}

function Seccion({
  icono: Icono,
  titulo,
  children,
}: {
  icono: typeof ShieldLock;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100 mb-3">
        <Icono className="w-5 h-5 text-marca shrink-0" />
        {titulo}
      </h2>
      <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
    </section>
  );
}
