import { httpsCallable } from "firebase/functions";
import { useEffect, useState, type FormEvent } from "react";
import { functions } from "./firebase.ts";
import { ActivationForm, UNEXPECTED_MESSAGE } from "./Holders.tsx";

// Las respuestas de `searchAffiliates` y `affiliateRecord` (functions/src/index.ts).
type Hit = { id: string; firstName: string; lastName: string; dni: string; number: string; isHolder: boolean };
type Status = "dependent" | "active" | "awaiting_acceptance" | "no_account";
type Person = { id: string; firstName: string; lastName: string; dni: string; age: number; status: Status };
type FamilyRecord = { holder: Person & { number: string; plan: string }; members: Person[] };

const searchAffiliates = httpsCallable<{ query: string }, Hit[]>(functions, "searchAffiliates");
const affiliateRecord = httpsCallable<{ affiliateId: string }, FamilyRecord>(functions, "affiliateRecord");

// Los mismos textos que `strings.xml` de la app de Android.
const STATUS_LABELS: Record<Status, string> = {
  no_account: "Sin cuenta",
  awaiting_acceptance: "Pendiente de aceptación",
  active: "Cuenta activa",
  dependent: "A cargo",
};
// El tope de `searchAffiliates` (functions/src/index.ts).
const SEARCH_LIMIT = 20;
const PLAN_LABELS: Record<string, string> = { family: "Familiar", comprehensive: "Integral" };

/** Buscador del padrón por DNI o apellido; cada resultado abre la ficha de su grupo familiar. */
export function Search({ onActivated }: { onActivated: () => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [hasError, setHasError] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    setHasError(false);
    setOpenId(null);
    try {
      setHits((await searchAffiliates({ query })).data);
    } catch {
      setHasError(true);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="card">
      <h2>Buscar en el padrón</h2>
      <form className="search-row" role="search" onSubmit={submit}>
        <input
          aria-label="DNI o apellido"
          placeholder="DNI o apellido"
          minLength={2}
          required
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn" disabled={isBusy}>
          Buscar
        </button>
      </form>
      {hasError && (
        <p className="msg-error" role="alert">
          {UNEXPECTED_MESSAGE}
        </p>
      )}
      {openId ? (
        <RecordView affiliateId={openId} onBack={() => setOpenId(null)} onActivated={onActivated} />
      ) : (
        <>
          {hits?.length === 0 && <p className="muted">No hay asociados con ese DNI o apellido.</p>}
          {hits?.length === SEARCH_LIMIT && (
            <p className="muted">Se muestran los primeros {SEARCH_LIMIT}. Si no aparece, afine la búsqueda.</p>
          )}
          {!!hits?.length && (
            <table>
              <thead>
                <tr>
                  <th>Apellido y nombre</th>
                  <th>DNI</th>
                  <th>N.º de asociado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {hits.map((hit) => (
                  <tr key={hit.id}>
                    <td>
                      <button className="link" onClick={() => setOpenId(hit.id)}>
                        {hit.lastName}, {hit.firstName}
                      </button>
                    </td>
                    <td className="mono">{hit.dni}</td>
                    <td className="mono">{hit.number}</td>
                    <td className="muted">{hit.isHolder ? "Titular" : "Del grupo familiar"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}

/** Ficha: el titular, el campo de código si no tiene cuenta, y su grupo familiar con el estado de cada miembro. */
function RecordView({ affiliateId, onBack, onActivated }: { affiliateId: string; onBack: () => void; onActivated: () => void }) {
  const [record, setRecord] = useState<FamilyRecord | null>(null);
  const [hasError, setHasError] = useState(false);
  const [activatedMessage, setActivatedMessage] = useState<string | null>(null);

  const load = () =>
    affiliateRecord({ affiliateId })
      .then(({ data }) => setRecord(data))
      .catch(() => setHasError(true));
  // `load` solo depende de `affiliateId`.
  useEffect(() => void load(), [affiliateId]);

  const back = (
    <button className="ghost" onClick={onBack}>
      Volver a los resultados
    </button>
  );
  if (hasError) {
    return (
      <div className="record">
        <p className="msg-error" role="alert">
          {UNEXPECTED_MESSAGE}
        </p>
        {back}
      </div>
    );
  }
  if (!record) return <p className="muted">Cargando…</p>;

  const { holder, members } = record;
  const row = (p: Person) => (
    <tr key={p.id} className={p.id === affiliateId ? "highlight" : undefined}>
      <td>
        {p.lastName}, {p.firstName}
      </td>
      <td className="mono">{p.dni}</td>
      <td>{p.age}</td>
      <td>
        <span className={`pill pill-${p.status}`}>{STATUS_LABELS[p.status]}</span>
      </td>
    </tr>
  );

  return (
    <div className="record">
      {back}
      <h3>
        {holder.lastName}, {holder.firstName}
      </h3>
      <p className="muted">
        Titular · DNI <span className="mono">{holder.dni}</span> · N.º <span className="mono">{holder.number}</span> ·{" "}
        {PLAN_LABELS[holder.plan] ?? holder.plan}
      </p>
      {activatedMessage && (
        <p className="msg-ok" role="status">
          {activatedMessage}
        </p>
      )}
      {holder.status === "no_account" && (
        <div>
          <p className="muted">Ingrese el código de 4 dígitos que muestra la app del titular.</p>
          <ActivationForm
            holder={holder}
            onAttempt={() => setActivatedMessage(null)}
            onActivated={() => {
              setActivatedMessage(`Cuenta activada: ${holder.firstName} ${holder.lastName}.`);
              onActivated();
              load();
            }}
          />
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>Grupo familiar</th>
            <th>DNI</th>
            <th>Edad</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>{[holder, ...members].map(row)}</tbody>
      </table>
    </div>
  );
}
