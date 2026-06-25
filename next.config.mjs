import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Librerías de Node que Next NO debe empaquetar, sino requerir en runtime: nodemailer (correo),
  // @napi-rs/canvas (binario nativo que usa unpdf para renderizar PDFs escaneados a imagen) y
  // @react-pdf/renderer (genera el acta de homologación en PDF; trae su propio motor de layout).
  experimental: {
    serverComponentsExternalPackages: ['nodemailer', '@napi-rs/canvas', '@react-pdf/renderer'],
  },
  // La raíz "/" redirige a "/casos" desde src/app/page.tsx (un solo lugar para
  // evitar duplicar la regla y los redirects permanentes que cachea el navegador).
  webpack(config) {
    config.resolve.alias['@'] = path.join(__dirname, 'src');
    return config;
  },
}
export default nextConfig
