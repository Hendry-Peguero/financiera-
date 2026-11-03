import { useState } from 'react';

/** Aviso fijo de la demostración: los datos son de ejemplo y nada se guarda en un servidor. */
export function AvisoDemo() {
  const [abierto, setAbierto] = useState(true);
  if (!abierto) return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 9999,
        maxWidth: 'calc(100vw - 24px)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 10,
        background: '#172b4d',
        color: '#fff',
        font: '500 12px/1.4 Inter Variable, system-ui, sans-serif',
        boxShadow: '0 4px 14px rgba(0,0,0,.25)',
      }}
    >
      <span>
        <strong>Demostración</strong> · datos de ejemplo; pulse «Entrar a mi espacio», no hace falta escribir nada. Los cambios se pierden al recargar.
      </span>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={() => setAbierto(false)}
        style={{ background: 'transparent', border: 0, color: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}
