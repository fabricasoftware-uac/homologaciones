"use client";

import { useFormState, useFormStatus } from "react-dom";
import { LayoutGrid } from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ingresar, registrarse, type EstadoAuth } from "./acciones";

const estadoInicial: EstadoAuth = null;

// Botón de envío que se deshabilita y cambia de texto mientras la server action está corriendo.
// useFormStatus solo funciona dentro del <form>, por eso va en su propio componente.
function BotonEnviar({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Procesando…" : children}
    </Button>
  );
}

export default function PaginaIngresar() {
  // Cada formulario lleva su propio estado de error, devuelto por su server action.
  const [estadoIngreso, accionIngresar] = useFormState(ingresar, estadoInicial);
  const [estadoRegistro, accionRegistrarse] = useFormState(registrarse, estadoInicial);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 font-sans">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="bg-blue-800 p-2 rounded-lg">
            <LayoutGrid className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-bold text-slate-900 tracking-tight">TransfoEdu</span>
        </div>

        <Tabs
          defaultValue="ingresar"
          className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm"
        >
          <TabsList className="w-full">
            <TabsTrigger value="ingresar" className="flex-1">
              Ingresar
            </TabsTrigger>
            <TabsTrigger value="registrarse" className="flex-1">
              Registrarse
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ingresar">
            <form action={accionIngresar} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="correo-ingreso">Correo</Label>
                <Input
                  id="correo-ingreso"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="tu@correo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clave-ingreso">Contraseña</Label>
                <Input
                  id="clave-ingreso"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </div>
              {estadoIngreso?.error && (
                <p className="text-sm text-destructive">{estadoIngreso.error}</p>
              )}
              <BotonEnviar>Ingresar</BotonEnviar>
            </form>
          </TabsContent>

          <TabsContent value="registrarse">
            <form action={accionRegistrarse} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="nombre-registro">Nombre</Label>
                <Input
                  id="nombre-registro"
                  name="nombre"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Tu nombre completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="correo-registro">Correo</Label>
                <Input
                  id="correo-registro"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="tu@correo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clave-registro">Contraseña</Label>
                <Input
                  id="clave-registro"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <p className="text-xs text-slate-500">Mínimo 8 caracteres.</p>
              </div>
              {estadoRegistro?.error && (
                <p className="text-sm text-destructive">{estadoRegistro.error}</p>
              )}
              <BotonEnviar>Crear cuenta</BotonEnviar>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
