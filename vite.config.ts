import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: 'public',
  publicDir: false,
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, 'public', 'app.html'),
        dashboard: path.resolve(__dirname, 'public', 'dashboard.html'),
        contatos: path.resolve(__dirname, 'public', 'contatos.html'),
        campanhas: path.resolve(__dirname, 'public', 'campanhas.html'),
        transmissao: path.resolve(__dirname, 'public', 'transmissao.html'),
        inbox: path.resolve(__dirname, 'public', 'inbox.html'),
        automacao: path.resolve(__dirname, 'public', 'automacao.html'),
        fluxos: path.resolve(__dirname, 'public', 'fluxos.html'),
        funil: path.resolve(__dirname, 'public', 'funil.html'),
        whatsapp: path.resolve(__dirname, 'public', 'whatsapp.html'),
        configuracoes: path.resolve(__dirname, 'public', 'configuracoes.html'),
        conversas: path.resolve(__dirname, 'public', 'conversas.html'),
        conversasV2: path.resolve(__dirname, 'public', 'conversas-v2.html'),
        flowBuilder: path.resolve(__dirname, 'public', 'flow-builder.html'),
        login: path.resolve(__dirname, 'public', 'login.html')
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
