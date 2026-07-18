import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  build: {
    rollupOptions: {
      output: {
        // Manual Chunking zur Reduzierung der Payload-Größe und besseren Caching
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@xyflow/react')) return 'react-flow';
            if (id.includes('dagre')) return 'dagre';
            if (id.includes('@google/generative-ai')) return 'ai-sdk';
            if (id.includes('lucide-react')) return 'icons';
            
            // Alles andere aus node_modules landet in einem allgemeinen 'vendor'-Paket
            return 'vendor';
          }
        }
      }
    },
    minify: 'esbuild', // Vite nutzt standardmäßig esbuild, was sehr schnell ist
    sourcemap: false   // Deaktiviere Sourcemaps im Build für kleinere Dateien
  }
})
