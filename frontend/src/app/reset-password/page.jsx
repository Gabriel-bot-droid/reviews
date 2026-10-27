"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, decodeToken } from "@/utils/api";

export default function ResetPasswordPage() {
  const router = useRouter();

  // Estados del formulario
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Protección: Si no está autenticado o no requiere cambio de clave, sacarlo de aquí
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/login");
        return;
      }
      const decoded = decodeToken(token);
      if (!decoded) {
        router.push("/login");
        return;
      }
      // Si el token indica que NO requiere cambiar contraseña, redirigir al panel normal
      if (!decoded.requires_password_change) {
        if (decoded.role === "superadmin") {
          router.push("/superadmin");
        } else {
          router.push("/admin");
        }
      }
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (newPassword !== confirmPassword) {
      setErrorMessage("Las contraseñas nuevas no coinciden.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setSuccessMessage("¡Contraseña actualizada exitosamente! Redirigiéndote a tu panel...");
      
      // Cerrar sesión para obligar a que inicien con la nueva contraseña e invalidar el JWT temporal
      setTimeout(() => {
        api.auth.logout();
      }, 3000);
    } catch (err) {
      setErrorMessage(err.message || "Error al actualizar la contraseña. Revisa tus datos.");
      setLoading(false);
    }
  };

  return (
    <div className="reset-layout">
      <div className="reset-container slide-up">
        {/* Header */}
        <div className="reset-header">
          <div className="reset-logo">🔒</div>
          <h1 className="reset-title font-bold">Cambio de Contraseña Obligatorio</h1>
          <p className="reset-subtitle">
            Detectamos que estás ingresando con una **contraseña temporal**. Por seguridad, debes actualizarla para activar tu cuenta.
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit}>
          {errorMessage && (
            <div className="reset-alert alert-error fade-in">
              <span>⚠️</span>
              <p>{errorMessage}</p>
            </div>
          )}

          {successMessage && (
            <div className="reset-alert alert-success fade-in">
              <span>🎉</span>
              <p>{successMessage}</p>
            </div>
          )}

          <div className="input-group">
            <label className="input-label" htmlFor="current-pass">
              Contraseña Temporal Actual
            </label>
            <input
              id="current-pass"
              type="password"
              placeholder="Ingresa la clave temporal"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={loading || !!successMessage}
              className="input"
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="new-pass">
              Nueva Contraseña Definitiva
            </label>
            <input
              id="new-pass"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={loading || !!successMessage}
              className="input"
            />
          </div>

          <div className="input-group" style={{ marginBottom: "2rem" }}>
            <label className="input-label" htmlFor="confirm-pass">
              Confirmar Nueva Contraseña
            </label>
            <input
              id="confirm-pass"
              type="password"
              placeholder="Repite la nueva contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading || !!successMessage}
              className="input"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !!successMessage}
            className="btn btn-primary btn-block"
          >
            {loading ? <div className="spinner spinner-white"></div> : "Guardar y Activar Cuenta"}
          </button>
        </form>
      </div>

      {/* Estilos específicos */}
      <style jsx global>{`
        .reset-layout {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
          padding: 1.25rem;
          color: #f1f5f9;
        }

        .reset-container {
          width: 100%;
          max-width: 440px;
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
          padding: 2.5rem 2rem;
        }

        .reset-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .reset-logo {
          font-size: 2.5rem;
          margin-bottom: 0.75rem;
          display: inline-block;
        }

        .reset-title {
          font-size: 1.35rem;
          font-weight: 700;
          color: white;
          margin-bottom: 0.5rem;
          line-height: 1.3;
        }

        .reset-subtitle {
          font-size: 0.85rem;
          color: #94a3b8;
          line-height: 1.5;
        }

        .reset-alert {
          border-radius: 10px;
          padding: 0.75rem 1rem;
          margin-bottom: 1.5rem;
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
          font-size: 0.875rem;
        }

        .alert-error {
          background-color: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .alert-success {
          background-color: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.2);
          color: #4ade80;
        }

        .reset-alert p {
          font-weight: 500;
          margin: 0;
        }

        .btn-block {
          width: 100%;
        }

        .spinner-white {
          border-color: rgba(255, 255, 255, 0.2);
          border-top-color: white;
        }

        .font-bold {
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
