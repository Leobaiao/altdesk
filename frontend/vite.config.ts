import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "Altdesk",
        short_name: "Altdesk",
        description: "Plataforma de Atendimento e Chamados",
        theme_color: "#00a884",
        icons: [
          {
            src: "icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml"
          },
          {
            src: "icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml"
          }
        ]
      }
    })
  ],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:3003",
        changeOrigin: true
      },
      "/socket.io": {
        target: "http://localhost:3003",
        ws: true
      }
    }
  }
});

