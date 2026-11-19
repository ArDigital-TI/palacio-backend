import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "./firebase.ts";
import { Holders } from "./Holders.tsx";

type Session = { status: "loading" } | { status: "signedOut" } | { status: "signedIn"; user: User; isOperator: boolean };

/** Entrada con Google y control del acceso de operador. La consola nunca llama a `registerAccount`. */
export function App() {
  const [session, setSession] = useState<Session>({ status: "loading" });
  const [signInError, setSignInError] = useState(false);

  const signIn = () => {
    setSignInError(false);
    signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => {
      // Cerrar la ventana de Google no es un error.
      if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") setSignInError(true);
    });
  };

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) return setSession({ status: "signedOut" });
        try {
          // Token nuevo: el acceso pudo darse o quitarse después de la última sesión.
          const { claims } = await user.getIdTokenResult(true);
          // Si salió mientras se pedía el token, esta respuesta llega tarde y no vale.
          if (auth.currentUser?.uid !== user.uid) return;
          setSession({ status: "signedIn", user, isOperator: claims.operator === true });
        } catch {
          // Sin red o con el token revocado: vuelve a la entrada en vez de quedar en «Cargando…».
          setSignInError(true);
          await signOut(auth);
        }
      }),
    [],
  );

  if (session.status === "loading") return <main className="center muted">Cargando…</main>;

  if (session.status === "signedOut") {
    return (
      <main className="center card">
        <h1>Consola del operador</h1>
        <p className="muted">Fundación Palacio · Adhesiones</p>
        <button className="btn" onClick={signIn}>
          Entrar con Google
        </button>
        {signInError && (
          <p className="msg-error" role="alert">
            No se pudo entrar con Google. Revise la conexión y, si el navegador bloqueó la ventana emergente,
            habilítela para este sitio. Después intente de nuevo.
          </p>
        )}
      </main>
    );
  }

  const { user, isOperator } = session;
  const signOutButton = (
    <button className="ghost" onClick={() => signOut(auth)}>
      Salir
    </button>
  );

  if (!isOperator) {
    return (
      <main className="center card">
        <h1>Sin acceso de operador</h1>
        <p>
          La cuenta <b>{user.email}</b> no tiene acceso de operador. Pídaselo a un administrador y vuelva a entrar.
        </p>
        {signOutButton}
      </main>
    );
  }

  return (
    <div className="wrap">
      <header className="top">
        <h1>Consola del operador</h1>
        <span className="muted">{user.email}</span>
        {signOutButton}
      </header>
      <Holders />
    </div>
  );
}
