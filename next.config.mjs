import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // La raíz "/" redirige a "/casos" desde src/app/page.tsx (un solo lugar para
  // evitar duplicar la regla y los redirects permanentes que cachea el navegador).
  webpack(config) {
    config.resolve.alias['@'] = path.join(__dirname, 'src');
    return config;
  },
}
export default nextConfig
