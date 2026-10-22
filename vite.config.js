import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// BASE_PATH: subpasta onde o site é servido (ex.: /Express-bateria-Rio/ no GitHub Pages).
// NOINDEX=1: marca a publicação como prévia, para não concorrer no Google com o domínio oficial.
const base = process.env.BASE_PATH || '/';

// PREVIEW_URL: endereço da prévia. A imagem de compartilhamento (WhatsApp etc.) passa a vir dele,
// porque o domínio oficial ainda não serve esses arquivos. O canonical continua no domínio oficial.
const OFFICIAL_URL = 'https://expressbateriasrio.com.br/';

const noindexPreview = () => ({
  name: 'noindex-preview',
  transformIndexHtml(html) {
    const preview = process.env.PREVIEW_URL;
    if (preview) html = html.replaceAll(`content="${OFFICIAL_URL}og-image.jpg"`, `content="${preview}og-image.jpg"`);
    if (!process.env.NOINDEX || html.includes('name="robots"')) return html;
    return html.replace('<head>', '<head>\n  <meta name="robots" content="noindex, nofollow">');
  },
});

export default defineConfig({
  base,
  plugins: [noindexPreview()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        privacidade: resolve(import.meta.dirname, 'privacidade.html'),
        notFound: resolve(import.meta.dirname, '404.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
      },
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
