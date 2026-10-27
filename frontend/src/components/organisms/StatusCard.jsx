import React from "react";

export default function StatusCard({ type, message }) {
  if (type === "loading") {
    return (
      <div className="step-content fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div className="rating-spinner" />
        <p style={{ marginTop: "1rem", opacity: 0.6, fontSize: "0.9rem" }}>
          {message || "Cargando..."}
        </p>
      </div>
    );
  }

  if (type === "suspended") {
    return (
      <div className="step-content fade-in">
        <div className="rating-status-icon">⚠️</div>
        <h2 className="rating-title">Servicio Suspendido</h2>
        <p className="rating-description" style={{ marginBottom: 0 }}>
          {message || "El servicio para este establecimiento se encuentra temporalmente inactivo. Si eres el administrador del local, comunícate con soporte."}
        </p>
      </div>
    );
  }

  // Fallback a error
  return (
    <div className="step-content fade-in">
      <div className="rating-status-icon">❌</div>
      <h2 className="rating-title">Local no encontrado</h2>
      <p className="rating-description" style={{ marginBottom: 0 }}>
        {message || "El código escaneado no es válido o ha expirado. Por favor, vuelve a escanear el código NFC del local."}
      </p>
    </div>
  );
}
