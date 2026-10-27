"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, decodeToken } from "@/utils/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleRedirect = (token) => {
    const decoded = decodeToken(token);
    if (decoded && decoded.role === "superadmin") {
      router.push("/superadmin");
    } else if (decoded && decoded.requires_password_change) {
      router.push("/reset-password");
    } else {
      router.push("/admin");
    }
  };

  // Redirigir al panel si ya está autenticado
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("admin_token");
      if (token) {
        handleRedirect(token);
      }
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const data = await api.auth.login(email, password);
      if (data && data.access_token) {
        handleRedirect(data.access_token);
      } else {
        router.push("/admin");
      }
    } catch (err) {
      setErrorMessage(err.message || "Credenciales incorrectas. Intenta de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div className="login-layout">
      <div className="login-container slide-up">
        {/* Header */}
        <div className="login-header">

          <h1 className="login-title">QuickFeedback NFC</h1>
          <p className="login-subtitle">Inicia sesión en tu panel administrativo</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit}>
          {errorMessage && (
            <div className="login-error-card fade-in">
              <span>⚠️</span>
              <p>{errorMessage}</p>
            </div>
          )}

          <div className="input-group">
            <label className="input-label" htmlFor="email">
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              placeholder="ejemplo@miempresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="input"
            />
          </div>

          <div className="input-group" style={{ marginBottom: "2rem" }}>
            <label className="input-label" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-block"
          >
            {loading ? <div className="spinner spinner-white"></div> : "Iniciar Sesión"}
          </button>
        </form>
      </div>

      {/* Estilos específicos del Login */}
      <style jsx global>{`
        .login-layout {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--muted-light) / 0.5) 100%);
          padding: 1.25rem;
        }

        .login-container {
          width: 100%;
          max-width: 400px;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 20px;
          box-shadow: var(--shadow-lg);
          padding: 2.5rem 2rem;
        }

        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .login-logo-fallback {
          font-size: 2.25rem;
          margin-bottom: 0.75rem;
          display: inline-block;
        }

        .login-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: hsl(var(--foreground));
          margin-bottom: 0.25rem;
        }

        .login-subtitle {
          font-size: 0.875rem;
          color: hsl(var(--muted));
        }

        .login-error-card {
          background-color: hsl(var(--error) / 0.1);
          border: 1px solid hsl(var(--error) / 0.2);
          border-radius: 10px;
          padding: 0.75rem 1rem;
          margin-bottom: 1.25rem;
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
          color: hsl(var(--error));
          font-size: 0.875rem;
        }

        .login-error-card p {
          font-weight: 500;
        }

        .btn-block {
          width: 100%;
        }

        .spinner-white {
          border-color: rgba(255, 255, 255, 0.2);
          border-top-color: white;
        }
      `}</style>
    </div>
  );
}
