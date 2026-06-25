"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  IconBuilding as Building2,
  IconPalette as Palette,
  IconPhotoPlus as ImagePlus,
  IconDeviceFloppy as Save,
  IconBriefcase as Briefcase,
  IconBook as BookOpen,
  IconPhoto as Photo,
  IconCheck as Check,
  IconBell as Bell,
  IconScale as Scale,
  IconMoon as Moon,
  IconSun as Sun,
} from "@tabler/icons-react";
import { sileo } from "sileo";
import clsx from "clsx";

import type { Configuracion } from "@/lib/marca/configuracion";
import { FONDOS, gradienteDe } from "@/lib/marca/fondos";
import { TEMAS_OSCUROS, temaOscuroDe } from "@/lib/marca/temas-oscuros";
import { POSICIONES_NOTIF } from "@/lib/marca/notif";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { guardarConfiguracion, type EstadoMarca } from "./acciones";

// Texto legible (oscuro o blanco) sobre un color, para la vista previa del botón.
function contraste(hex: string): string {
  const limpio = hex.replace("#", "").trim();
  if (limpio.length !== 3 && limpio.length !== 6) return "#ffffff";
  const v = limpio.length === 3 ? limpio.split("").map((c) => c + c).join("") : limpio;
  const n = parseInt(v, 16);
  if (Number.isNaN(n)) return "#ffffff";
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0f172a" : "#ffffff";
}

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 bg-marca text-marca-fg px-6 py-2.5 rounded-xl font-bold hover:bg-marca-hover disabled:opacity-60 transition-colors shadow-sm"
    >
      <Save className="w-4 h-4" />
      {pending ? "Guardando..." : "Guardar cambios"}
    </button>
  );
}

function CampoColor({
  id,
  etiqueta,
  valor,
  onChange,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 block">
        {etiqueta}
      </label>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="color"
          name={id}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-11 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 cursor-pointer shrink-0"
        />
        <input
          type="text"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="w-32 px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>
    </div>
  );
}

// Campo de subida de logo (claro u oscuro) con previsualización, descripción y botón. La preview se
// muestra sobre el fondo en el que el logo va a vivir (claro u oscuro), para que se note si se ve.
function CampoLogo({
  etiqueta,
  descripcion,
  preview,
  inicial,
  primario,
  fgPrimario,
  inputRef,
  name,
  onChange,
  fondoOscuro,
}: {
  etiqueta: string;
  descripcion: string;
  preview: string | null;
  inicial: string;
  primario: string;
  fgPrimario: string;
  inputRef: React.RefObject<HTMLInputElement>;
  name: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fondoOscuro?: boolean;
}) {
  return (
    <div>
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 block">{etiqueta}</span>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 mb-2">{descripcion}</p>
      <div className="flex items-center gap-4">
        <div
          className={clsx(
            "w-16 h-16 rounded-xl border flex items-center justify-center overflow-hidden shrink-0",
            fondoOscuro
              ? "border-slate-700 bg-slate-900"
              : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white",
          )}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={etiqueta} className="w-full h-full object-contain p-1" />
          ) : (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-bold"
              style={{ background: primario, color: fgPrimario }}
            >
              {inicial}
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={onChange}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <ImagePlus className="w-4 h-4" /> {preview ? "Cambiar" : "Subir"}
        </button>
        <span className="text-xs text-slate-400 dark:text-slate-500">PNG, SVG o JPG · máx. 2 MB</span>
      </div>
    </div>
  );
}

// Mockup en miniatura de la app (sidebar + contenido), parametrizado por colores de superficie. Se
// usa en la vista previa para mostrar el mismo diseño en claro y en oscuro (con la paleta elegida).
function MiniApp({
  colores,
  marca,
}: {
  colores: { sidebar: string; sidebarTexto: string; sidebarTenue: string; contenido: string; barra: string };
  marca: {
    primario: string;
    fgPrimario: string;
    acento: string;
    fgAcento: string;
    nombre: string;
    logo: string | null;
    inicial: string;
  };
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="flex h-40">
        <div className="w-24 p-2.5 flex flex-col gap-2.5" style={{ background: colores.sidebar }}>
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0"
              style={{ background: marca.primario, color: marca.fgPrimario }}
            >
              {marca.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={marca.logo} alt="" className="w-full h-full object-contain" />
              ) : (
                marca.inicial
              )}
            </div>
            <span className="text-[9px] font-semibold truncate" style={{ color: colores.sidebarTexto }}>
              {marca.nombre || "Institución"}
            </span>
          </div>
          <div className="space-y-1 mt-0.5">
            <div
              className="relative flex items-center gap-1 px-1 py-1 rounded-md"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <span className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full" style={{ background: marca.primario }} />
              <Briefcase className="w-2.5 h-2.5" style={{ color: marca.primario }} />
              <span className="text-[9px]" style={{ color: colores.sidebarTexto }}>Casos</span>
            </div>
            <div className="flex items-center gap-1 px-1 py-1">
              <BookOpen className="w-2.5 h-2.5" style={{ color: colores.sidebarTenue }} />
              <span className="text-[9px]" style={{ color: colores.sidebarTenue }}>Planes</span>
            </div>
          </div>
        </div>
        <div className="flex-1 p-2.5 flex flex-col gap-2" style={{ background: colores.contenido }}>
          <div className="h-2.5 w-16 rounded" style={{ background: colores.barra }} />
          <div className="h-2 w-20 rounded opacity-70" style={{ background: colores.barra }} />
          <span
            className="inline-flex w-fit items-center text-[8px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: marca.acento, color: marca.fgAcento }}
          >
            Acento
          </span>
          <div className="mt-auto">
            <span
              className="inline-block text-[10px] font-bold px-2.5 py-1 rounded-lg"
              style={{ background: marca.primario, color: marca.fgPrimario }}
            >
              Botón
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FormularioMarca({ inicial }: { inicial: Configuracion }) {
  const [estado, accion] = useFormState<EstadoMarca, FormData>(guardarConfiguracion, null);

  const [nombre, setNombre] = useState(inicial.nombre);
  const [eslogan, setEslogan] = useState(inicial.eslogan);
  const [primario, setPrimario] = useState(inicial.colorPrimario);
  const [acento, setAcento] = useState(inicial.colorAcento);
  const [colorEliminar, setColorEliminar] = useState(inicial.colorEliminar);
  const [fondoLogin, setFondoLogin] = useState(inicial.fondoLogin);
  const [notifColor, setNotifColor] = useState(inicial.notifColor);
  const [notifPosicion, setNotifPosicion] = useState(inicial.notifPosicion);
  const [notaMinima, setNotaMinima] = useState(String(inicial.notaMinima));
  const [temaOscuro, setTemaOscuro] = useState(inicial.temaOscuro);
  const [logoPreview, setLogoPreview] = useState<string | null>(inicial.logoUrl);
  const [logoOscuroPreview, setLogoOscuroPreview] = useState<string | null>(inicial.logoOscuroUrl);
  const inputLogo = useRef<HTMLInputElement>(null);
  const inputLogoOscuro = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (estado && "error" in estado) {
      sileo.error({ title: "No se pudo guardar", description: estado.error });
    } else if (estado && "ok" in estado) {
      sileo.success({ title: "Personalización guardada", description: "Los cambios ya están aplicados." });
    }
  }, [estado]);

  function alElegirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setLogoPreview(URL.createObjectURL(f));
  }

  function alElegirLogoOscuro(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setLogoOscuroPreview(URL.createObjectURL(f));
  }

  const fgPrimario = contraste(primario);
  const fgAcento = contraste(acento);
  const inicialNombre = nombre.charAt(0).toUpperCase() || "T";

  // Datos derivados para las vistas previas (se recalculan en vivo al editar).
  const tema = temaOscuroDe(temaOscuro);
  const gradLogin =
    fondoLogin === "marca"
      ? `linear-gradient(135deg, ${primario}, #0b1220 55%, ${acento})`
      : gradienteDe(fondoLogin);
  // El sidebar de los mockups y el panel del login son SIEMPRE oscuros, así que ahí va la versión
  // clara/blanca del logo (con fallback al de modo claro si no hay versión oscura).
  const logoSuperficieOscura = logoOscuroPreview ?? logoPreview;
  const marcaPreview = {
    primario,
    fgPrimario,
    acento,
    fgAcento,
    nombre,
    logo: logoSuperficieOscura,
    inicial: inicialNombre,
  };

  return (
    <form action={accion} className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* Campos */}
      <div className="space-y-6">
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Identidad
          </h2>
          <div>
            <label htmlFor="nombre" className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 block">
              Nombre de la institución
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej.: Corporación Universitaria…"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700 dark:text-slate-200"
            />
          </div>

          <div>
            <label htmlFor="eslogan" className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 block">
              Eslogan <span className="text-slate-400 dark:text-slate-500 font-normal">(se muestra en el login)</span>
            </label>
            <input
              id="eslogan"
              name="eslogan"
              type="text"
              value={eslogan}
              onChange={(e) => setEslogan(e.target.value)}
              placeholder="Ej.: Homologa tu carrera en minutos"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700 dark:text-slate-200"
            />
          </div>

          <CampoLogo
            etiqueta="Logo (modo claro)"
            descripcion="Para fondo claro: usa un logo oscuro o de color, para que se vea sobre el blanco."
            preview={logoPreview}
            inicial={inicialNombre}
            primario={primario}
            fgPrimario={fgPrimario}
            inputRef={inputLogo}
            name="logo"
            onChange={alElegirLogo}
          />
          <CampoLogo
            etiqueta="Logo (modo oscuro)"
            descripcion="Para fondo oscuro: usa un logo claro o blanco, para que se vea. Opcional: si no lo subes, se usa el de modo claro."
            preview={logoOscuroPreview}
            inicial={inicialNombre}
            primario={primario}
            fgPrimario={fgPrimario}
            inputRef={inputLogoOscuro}
            name="logo_oscuro"
            onChange={alElegirLogoOscuro}
            fondoOscuro
          />
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Palette className="w-4 h-4" /> Colores
          </h2>
          <div className="flex flex-wrap gap-6">
            <CampoColor id="color_primario" etiqueta="Color primario" valor={primario} onChange={setPrimario} />
            <CampoColor id="color_acento" etiqueta="Color de acento" valor={acento} onChange={setAcento} />
            <CampoColor id="color_eliminar" etiqueta="Color de eliminar" valor={colorEliminar} onChange={setColorEliminar} />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            El <strong className="font-semibold text-slate-500 dark:text-slate-400">primario</strong> tiñe botones, el
            menú activo y la mayoría de acentos. El de{" "}
            <strong className="font-semibold text-slate-500 dark:text-slate-400">acento</strong> se usa en el fondo del
            login. El de{" "}
            <strong className="font-semibold text-slate-500 dark:text-slate-400">eliminar</strong> es el del botón que
            confirma los borrados.
          </p>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Photo className="w-4 h-4" /> Fondo del login
          </h2>
          <input type="hidden" name="fondo_login" value={fondoLogin} />
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {FONDOS.map((f) => {
              // El preset "marca" se previsualiza con los colores que se están editando ahora mismo.
              const grad =
                f.clave === "marca"
                  ? `linear-gradient(135deg, ${primario}, #0b1220 55%, ${acento})`
                  : f.gradiente;
              const seleccionado = fondoLogin === f.clave;
              return (
                <button
                  key={f.clave}
                  type="button"
                  onClick={() => setFondoLogin(f.clave)}
                  title={f.nombre}
                  className={clsx(
                    "relative h-16 rounded-xl overflow-hidden border-2 transition-all",
                    seleccionado
                      ? "border-marca ring-2 ring-marca/30"
                      : "border-transparent hover:scale-[1.03]",
                  )}
                  style={{ backgroundImage: grad }}
                >
                  <span className="absolute bottom-1 left-1.5 text-[10px] font-semibold text-white/90 drop-shadow">
                    {f.nombre}
                  </span>
                  {seleccionado && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white dark:bg-slate-900 text-marca flex items-center justify-center">
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">Se aplica en la pantalla de ingreso.</p>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Moon className="w-4 h-4" /> Modo oscuro
          </h2>
          <input type="hidden" name="tema_oscuro" value={temaOscuro} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {TEMAS_OSCUROS.map((t) => {
              const seleccionado = temaOscuro === t.clave;
              return (
                <button
                  key={t.clave}
                  type="button"
                  onClick={() => setTemaOscuro(t.clave)}
                  className={clsx(
                    "relative flex items-center gap-2.5 rounded-xl p-2.5 border-2 transition-colors text-left",
                    seleccionado
                      ? "border-marca ring-2 ring-marca/30"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700",
                  )}
                >
                  {/* Mini-previa de la paleta: fondo (degradado) + superficie + muted. */}
                  <span
                    className="w-11 h-9 rounded-lg shrink-0 overflow-hidden border flex items-end gap-0.5 p-1"
                    style={{ background: t.gradiente, borderColor: t.borde }}
                  >
                    <span className="w-3.5 h-4 rounded" style={{ background: t.superficie }} />
                    <span className="w-2 h-4 rounded" style={{ background: t.muted }} />
                  </span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate flex-1">
                    {t.nombre}
                  </span>
                  {seleccionado && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-marca text-marca-fg flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Define los colores de las superficies cuando el usuario activa el modo oscuro. El modo
            claro no cambia.
          </p>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Bell className="w-4 h-4" /> Notificaciones
          </h2>
          <div className="flex flex-wrap gap-6 items-start">
            <CampoColor id="notif_color" etiqueta="Color" valor={notifColor} onChange={setNotifColor} />
            <div>
              <label htmlFor="notif_posicion" className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 block">
                Posición
              </label>
              <Select name="notif_posicion" value={notifPosicion} onValueChange={setNotifPosicion}>
                <SelectTrigger className="w-48 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSICIONES_NOTIF.map((p) => (
                    <SelectItem key={p.clave} value={p.clave}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                sileo.success({
                  title: "Notificación de prueba",
                  description: "Así se ven las notificaciones.",
                })
              }
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Bell className="w-4 h-4" /> Probar notificación
            </button>
            <p className="text-xs text-slate-400 dark:text-slate-500">El color y la posición se aplican al guardar.</p>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Scale className="w-4 h-4" /> Homologación
          </h2>
          <div>
            <label htmlFor="nota_minima" className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 block">
              Nota mínima para homologar{" "}
              <span className="text-slate-400 dark:text-slate-500 font-normal">(escala 0–5)</span>
            </label>
            <input
              id="nota_minima"
              name="nota_minima"
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={notaMinima}
              onChange={(e) => setNotaMinima(e.target.value)}
              className="w-28 px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            En el estudio de cada caso se <strong className="font-semibold text-slate-500 dark:text-slate-400">avisa</strong>{" "}
            cuando una materia tiene una nota por debajo de este valor. No bloquea: la decisión final
            sigue siendo del asesor.
          </p>
        </section>

        <div className="flex justify-end">
          <BotonGuardar />
        </div>
      </div>

      {/* Vista previa en vivo: el mismo diseño en claro y en oscuro (con la paleta elegida) + el login. */}
      {/* top-24: deja libre la altura del encabezado sticky (la página scrollea en el shell). */}
      <aside className="lg:sticky lg:top-24 self-start space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Vista previa
        </p>

        <div>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5" /> Modo claro
          </p>
          <MiniApp
            colores={{
              sidebar: "#0f172a",
              sidebarTexto: "#ffffff",
              sidebarTenue: "#94a3b8",
              contenido: "#f8fafc",
              barra: "#e2e8f0",
            }}
            marca={marcaPreview}
          />
        </div>

        <div>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Moon className="w-3.5 h-3.5" /> Modo oscuro · {tema.nombre}
          </p>
          <MiniApp
            colores={{
              sidebar: tema.superficie,
              sidebarTexto: "#f1f5f9",
              sidebarTenue: "#64748b",
              contenido: tema.gradiente,
              barra: tema.muted,
            }}
            marca={marcaPreview}
          />
        </div>

        <div>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Photo className="w-3.5 h-3.5" /> Pantalla de ingreso
          </p>
          <div
            className="h-28 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col items-center justify-center gap-1.5"
            style={{ backgroundImage: gradLogin }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold overflow-hidden"
              style={{ background: "rgba(255,255,255,0.16)", color: "#ffffff" }}
            >
              {logoSuperficieOscura ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSuperficieOscura} alt="" className="w-full h-full object-contain p-0.5" />
              ) : (
                inicialNombre
              )}
            </div>
            <span className="text-[11px] font-bold text-white/95 drop-shadow">{nombre || "Institución"}</span>
            {eslogan && <span className="text-[9px] text-white/75 drop-shadow px-3 text-center truncate max-w-full">{eslogan}</span>}
          </div>
        </div>
      </aside>
    </form>
  );
}
