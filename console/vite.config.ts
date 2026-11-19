import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// El servidor de desarrollo habla con el Emulator Suite; todo build (Hosting) necesita el proyecto de `.env.dev`.
export default defineConfig(({ command, mode }) => {
  if (command === "build" && !loadEnv(mode, process.cwd()).VITE_FIREBASE_API_KEY) {
    throw new Error("Falta console/.env.dev con la configuración web del proyecto (ver console/.env.example).");
  }
  return { plugins: [react()], server: { port: 5173 } };
});
