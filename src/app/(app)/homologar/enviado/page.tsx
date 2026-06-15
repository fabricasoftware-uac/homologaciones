import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

// Confirmación tras enviar la solicitud. Por ahora es un acuse simple; cuando exista la lista
// "mis homologaciones", desde aquí enlazaremos al detalle del caso recién creado.
export default function PaginaEnviado() {
  return (
    <div className="max-w-xl mx-auto p-6 md:p-8">
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">¡Solicitud enviada!</h1>
        <p className="mt-2 text-slate-600">
          Recibimos tu certificado y estamos procesando tu homologación. Cuando el equipo revise
          tu caso podrás ver en qué semestre quedarías.
        </p>
        <Button asChild className="mt-6">
          <Link href="/homologar">Enviar otra solicitud</Link>
        </Button>
      </div>
    </div>
  );
}
