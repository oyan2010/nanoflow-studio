import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize bundle size
    target: 'es2015',
    cssCodeSplit: true,
    sourcemap: mode === 'development',

    rollupOptions: {
      output: {
        // Simplified manual chunks to ensure proper loading order
        manualChunks(id) {
          // React core - must load first
          if (id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }

          // React Router
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router';
          }

          // All Radix UI components together
          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-ui';
          }

          // Supabase
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase';
          }

          // React Query
          if (id.includes('node_modules/@tanstack/')) {
            return 'vendor-query';
          }

          // Other large vendor libraries
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion';
          }

          if (id.includes('node_modules/recharts')) {
            return 'vendor-charts';
          }

          // All other node_modules
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
        },

        // Asset naming
        assetFileNames: 'assets/[name]-[hash].[ext]',
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },

    // Chunk size warning limit
    chunkSizeWarningLimit: 600,

    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
      },
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
    ],
    exclude: ['@supabase/supabase-js'],
  },
}));
