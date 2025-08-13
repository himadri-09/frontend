import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    hmr: {
      host: process.env.PUBLIC_HOST || "localhost",
      port: 5173,
    },
    // Add allowed hosts to fix the blocking issue
    allowedHosts: [
      "localhost",
      process.env.PUBLIC_HOST, // Dynamic host from environment
      ".azurecontainerapps.io"  // Wildcard for any Azure Container Apps domain
    ].filter(Boolean), // Remove undefined values
    // For Azure Files - enable polling for reliable file watching
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
});





