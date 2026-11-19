import { httpsCallable } from "firebase/functions";
import { useState, type FormEvent } from "react";
import { functions } from "./firebase.ts";
import { UNEXPECTED_MESSAGE } from "./Holders.tsx";

type HolderData = { firstName: string; lastName: string; dni: string; birthDate: string; plan: string; email: string; phone: string };
const createHolder = httpsCallable<HolderData, { id: string }>(functions, "createHolder");

const EMPTY: HolderData = { firstName: "", lastName: "", dni: "", birthDate: "", plan: "family", email: "", phone: "" };

/** Último día en que pudo nacer alguien que hoy tiene 18 años, como `YYYY-MM-DD`. */
function adultBirthDateMax(today = new Date()) {
  const d = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Alta de un titular inventado en el padrón, para probar en `dev`.
 * ponytail: temporal, hasta que el padrón llegue del sistema de la Fundación (ticket 06).
 */
export function CreateHolder({ onCreated }: { onCreated: () => void }) {
  const [data, setData] = useState(EMPTY);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdMessage, setCreatedMessage] = useState<string | null>(null);
  const field = (name: keyof HolderData) => ({
    value: data[name],
    onChange: (e: { target: { value: string } }) => setData({ ...data, [name]: e.target.value }),
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    setCreatedMessage(null);
    try {
      await createHolder(data);
      setCreatedMessage(`Titular dado de alta: ${data.firstName.trim()} ${data.lastName.trim()}. Ya aparece en la lista de titulares sin cuenta.`);
      setData(EMPTY);
      onCreated();
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(
        code === "functions/already-exists"
          ? "Ese DNI ya está en el padrón."
          : code === "functions/invalid-argument"
            ? "Revise los datos: el DNI tiene 7 u 8 dígitos, el titular es mayor de 18 y el correo es válido."
            : UNEXPECTED_MESSAGE,
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <details className="card">
      <summary>
        <h2>Alta de titular de prueba</h2>
      </summary>
      <p className="muted">
        Solo para pruebas, mientras el padrón no llega del sistema de la Fundación. El titular queda sin cuenta y se
        activa como cualquier otro: con el código de su app, y solo si entró con la cuenta de Google de este correo.
      </p>
      <form className="create-form" onSubmit={submit}>
        <label>
          Nombre
          <input required autoComplete="off" {...field("firstName")} />
        </label>
        <label>
          Apellido
          <input required autoComplete="off" {...field("lastName")} />
        </label>
        <label>
          DNI
          <input
            required
            inputMode="numeric"
            autoComplete="off"
            pattern="\d{7,8}"
            title="7 u 8 dígitos"
            value={data.dni}
            // Sin `maxLength`: cortaría los puntos de «40.111.222» antes de quitarlos.
            onChange={(e) => setData({ ...data, dni: e.target.value.replace(/\D/g, "").slice(0, 8) })}
          />
        </label>
        <label>
          Fecha de nacimiento
          <input required type="date" max={adultBirthDateMax()} {...field("birthDate")} />
        </label>
        <label>
          Correo (su cuenta de Google)
          <input required type="email" autoComplete="off" {...field("email")} />
        </label>
        <label>
          Teléfono
          <input required type="tel" autoComplete="off" {...field("phone")} />
        </label>
        <label>
          Plan
          <select {...field("plan")}>
            <option value="family">Familiar</option>
            <option value="comprehensive">Integral</option>
          </select>
        </label>
        <button className="btn" disabled={isBusy}>
          Dar de alta
        </button>
      </form>
      {createdMessage && (
        <p className="msg-ok" role="status">
          {createdMessage}
        </p>
      )}
      {error && (
        <p className="msg-error" role="alert">
          {error}
        </p>
      )}
    </details>
  );
}
