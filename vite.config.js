import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import reactCompilerPreset from 'babel-plugin-react-compiler';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          [reactCompilerPreset, {}]
        ]
      }
    })
  ],
  build: {
    minify: 'terser', 
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@xyflow/react')) return 'react-flow';
            if (id.includes('@google/generative-ai')) return 'ai-sdk';
            if (id.includes('lucide-react')) return 'icons';
            return 'vendor';
          }
        }
      }
    }
  }
});