import { defineConfig } from 'vite';
import express from 'express';
import cors from 'cors';
import { resolve } from 'path';

import authRoutes from './src/routes/authRoutes.js';
import agendamentoRoutes from './src/routes/agendamentoRoutes.js';
import barbeiroRoutes from './src/routes/barbeiroRoutes.js';
import servicoRoutes from './src/routes/servicoRoutes.js';
import clienteRoutes from './src/routes/clienteRoutes.js';
import financeiroRoutes from './src/routes/financeiroRoutes.js';
import automacaoRoutes from './src/routes/automacaoRoutes.js';
import lgpdRoutes from './src/routes/lgpdRoutes.js';

function apiPlugin() {
  const apiApp = express();
  apiApp.use(cors());
  apiApp.use(express.json({ limit: '1mb' }));
  apiApp.use(express.urlencoded({ extended: true, limit: '1mb' }));

  apiApp.use('/api/auth', authRoutes);
  apiApp.use('/api/agendamentos', agendamentoRoutes);
  apiApp.use('/api/barbeiros', barbeiroRoutes);
  apiApp.use('/api/servicos', servicoRoutes);
  apiApp.use('/api/clientes', clienteRoutes);
  apiApp.use('/api/financeiro', financeiroRoutes);
  apiApp.use('/api/automacao', automacaoRoutes);
  apiApp.use('/api/lgpd', lgpdRoutes);

  return {
    name: 'api-server',
    configureServer(server) {
      server.middlewares.use(apiApp);
      
      // Clean URL Rewrites for sub-pages / sub-views
      server.middlewares.use((req, res, next) => {
        if (req.url === '/painel' || req.url === '/admin') {
          req.url = '/painel.html';
        } else if (req.url === '/portal' || req.url === '/minhaconta' || req.url === '/cliente') {
          req.url = '/portal.html';
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [apiPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        painel: resolve(__dirname, 'painel.html'),
        portal: resolve(__dirname, 'portal.html'),
        barbearia: resolve(__dirname, 'Barbearia.html'),
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
});
