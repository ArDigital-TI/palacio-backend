import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

// El servidor de desarrollo (`npm run console`) habla con el Emulator Suite; todo build, con el proyecto de `.env.dev`.
const isEmulator = import.meta.env.DEV;

const app = initializeApp(
  isEmulator
    ? { projectId: "demo-palacio", apiKey: "demo-key", authDomain: "demo-palacio.firebaseapp.com" }
    : {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      },
);

export const auth = getAuth(app);
// La misma región que `setGlobalOptions` en las Functions.
export const functions = getFunctions(app, "southamerica-east1");

if (isEmulator) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
