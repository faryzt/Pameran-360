import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const githubRepo = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base =
  process.env.GITHUB_ACTIONS === 'true' && githubRepo
    ? `/${githubRepo}/`
    : './';

export default defineConfig({
  base,
  plugins: [tailwindcss()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: false,
  },
});
