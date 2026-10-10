import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// בפיתוח: Vite על 5173, ושרת המשחק על 3001 (ה-proxy מעביר את Socket.IO)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/socket.io': { target: 'http://localhost:3001', ws: true }, '/health': 'http://localhost:3001' },
  },
});
