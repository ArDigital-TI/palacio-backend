import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "./firebase.ts";
import { CreateHolder } from "./CreateHolder.tsx";
import { Holders } from "./Holders.tsx";
import { Search } from "./Search.tsx";

type Session = { status: "loading" } | { status: "signedOut" } | { status: "signedIn"; user: User; isOperator: boolean };

/** Entrada con Google y control del acceso de operador. La consola nunca llama a `registerAccount`. */
export function App() {
  const [session, setSession] = useState<Session>({ status: "loading" });
  const [signInError, setSignInError] = useState(false);
  // Al dar de alta un titular, la lista de titulares sin cuenta se vuelve a pedir.
  const [holdersVersion, setHoldersVersion] = useState(0);
  const [hash, setHash] = useState(location.hash);

  const signIn = () => {
    setSignInError(false);
    signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => {
      // Cerrar la ventana de Google no es un error.
      if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") setSignInError(true);
    });
  };

  useEffect(() => {
    const onHashChange = () => setHash(location.hash);
    addEventListener("hashchange", onHashChange);
    return () => removeEventListener("hashchange", onHashChange);
  }, []);

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

  // Sin router: `#/pendientes` es la lista; cualquier otro hash, Atención.
  const isHoldersTab = hash === "#/pendientes";
  return (
    <>
      <header className="brand-bar">
        <img src="/isotipo-palacio-v2.svg" alt="" />
        <h1 className="brand-name">
          Palacio
          <span>Consola del operador</span>
        </h1>
        <nav className="tabs">
          <a href="#/" aria-current={isHoldersTab ? undefined : "page"}>
            Atención
          </a>
          <a href="#/pendientes" aria-current={isHoldersTab ? "page" : undefined}>
            Titulares sin cuenta
          </a>
        </nav>
        <span className="brand-user">{user.email}</span>
        {signOutButton}
      </header>
      <main className="wrap">
        {/* Las vistas quedan montadas para no perder lo escrito; la lista se monta al entrar y así se vuelve a pedir. */}
        <div className="view" hidden={isHoldersTab}>
          <Search />
        </div>
        <div className="view" hidden={!isHoldersTab}>
          <CreateHolder onCreated={() => setHoldersVersion((v) => v + 1)} />
          {isHoldersTab && <Holders key={holdersVersion} />}
        </div>
      </main>
    </>
  );
}
