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
        manualChunks: {
          'react-flow': ['@xyflow/react'],
          'dagre': ['dagre'],
          'ai-sdk': ['@google/generative-ai'],
          'icons': ['lucide-react']
        }
      }
    },
    minify: 'esbuild', // Vite nutzt standardmäßig esbuild, was sehr schnell ist
    sourcemap: false   // Deaktiviere Sourcemaps im Build für kleinere Dateien
  }
})
