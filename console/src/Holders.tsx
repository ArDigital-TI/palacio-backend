import { httpsCallable } from "firebase/functions";
import { useEffect, useId, useState, type FormEvent } from "react";
import { functions } from "./firebase.ts";

export type Holder = { id: string; firstName: string; lastName: string; dni: string };
// Los errores de dominio de `activateHolder` (functions/src/index.ts).
type DomainError = "IS_DEPENDENT" | "IS_ADHERENT" | "ALREADY_ACTIVE" | "INVALID_CODE";

// Los mismos textos que `strings.xml` de la app de Android.
const ERROR_MESSAGES: Record<DomainError, string> = {
  IS_DEPENDENT: "Es un miembro a cargo: su titular lo gestiona desde su cuenta.",
  IS_ADHERENT: "Es un adherente: lo valida su titular desde la app, con el QR o el enlace.",
  ALREADY_ACTIVE: "Este asociado ya tiene una cuenta activa.",
  INVALID_CODE: "Código inválido. Verifique el código que muestra la app del asociado.",
};
export // `reason` lo agrega `activateHolder` cuando el código vale pero el correo de la cuenta no es el del padrón.
const EMAIL_MISMATCH_MESSAGE =
  "El correo de la cuenta del titular no coincide con el del padrón. Verifique con el titular qué cuenta de Google eligió.";
export const UNEXPECTED_MESSAGE = "No se pudo completar. Revise la conexión e intente de nuevo.";

const holdersWithoutAccount = httpsCallable<void, Holder[]>(functions, "holdersWithoutAccount");
const activateHolder = httpsCallable<{ affiliateId: string; code: string }, { error: DomainError | null; reason?: "EMAIL_MISMATCH" }>(
  functions,
  "activateHolder",
);

const byName = (a: Holder, b: Holder) =>
  a.lastName.localeCompare(b.lastName, "es") || a.firstName.localeCompare(b.firstName, "es");

/** Titulares sin cuenta, ordenados por apellido, cada uno con su campo de código y el botón Activar. */
export function Holders() {
  const [holders, setHolders] = useState<Holder[] | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [activatedMessage, setActivatedMessage] = useState<string | null>(null);

  useEffect(() => {
    holdersWithoutAccount()
      .then(({ data }) => setHolders([...data].sort(byName)))
      .catch(() => setHasLoadError(true));
  }, []);

  // El activado sale de la lista en el momento; no hace falta volver a pedirla.
  const onActivated = (holder: Holder) => {
    setActivatedMessage(`Cuenta activada: ${holder.firstName} ${holder.lastName}.`);
    setHolders((current) => current?.filter((h) => h.id !== holder.id) ?? null);
  };

  return (
    <section className="card">
      <h2>Titulares sin cuenta</h2>
      <p className="muted">Ingrese el código de 4 dígitos que muestra la app del asociado.</p>
      {activatedMessage && (
        <p className="msg-ok" role="status">
          {activatedMessage}
        </p>
      )}
      {hasLoadError && (
        <p className="msg-error" role="alert">
          {UNEXPECTED_MESSAGE}
        </p>
      )}
      {holders === null && !hasLoadError && <p className="muted">Cargando…</p>}
      {holders?.length === 0 && <p className="muted">No quedan titulares sin cuenta activa.</p>}
      {!!holders?.length && (
        <table>
          <thead>
            <tr>
              <th>Apellido y nombre</th>
              <th>DNI</th>
              <th>Código de activación</th>
            </tr>
          </thead>
          <tbody>
            {holders.map((holder) => (
              <HolderRow
                key={holder.id}
                holder={holder}
                onActivated={() => onActivated(holder)}
                onAttempt={() => setActivatedMessage(null)}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function HolderRow({ holder, onActivated, onAttempt }: { holder: Holder; onActivated: () => void; onAttempt: () => void }) {
  return (
    <tr>
      <td>
        {holder.lastName}, {holder.firstName}
      </td>
      <td className="mono">{holder.dni}</td>
      <td>
        <ActivationForm holder={holder} onActivated={onActivated} onAttempt={onAttempt} />
      </td>
    </tr>
  );
}

/** Campo del código de activación y botón Activar de un titular, con el error de dominio debajo. */
export function ActivationForm({ holder, onActivated, onAttempt }: { holder: Holder; onActivated: () => void; onAttempt: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const name = `${holder.firstName} ${holder.lastName}`;
  // La misma persona puede estar en la lista y en una ficha abierta: el id tiene que ser único por formulario.
  const errorId = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    onAttempt();
    setIsBusy(true);
    setError(null);
    try {
      const { data } = await activateHolder({ affiliateId: holder.id, code });
      if (data.reason === "EMAIL_MISMATCH") setError(EMAIL_MISMATCH_MESSAGE);
      else if (data.error) setError(ERROR_MESSAGES[data.error] ?? UNEXPECTED_MESSAGE);
      else onActivated();
    } catch {
      setError(UNEXPECTED_MESSAGE);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <form className="activate-row" onSubmit={submit}>
        <input
          aria-label={`Código de ${name}`}
          aria-describedby={error ? errorId : undefined}
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          pattern="\d{4}"
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
        <button className="btn" disabled={isBusy} aria-label={`Activar a ${name}`}>
          Activar
        </button>
      </form>
      {error && (
        <p id={errorId} className="msg-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
