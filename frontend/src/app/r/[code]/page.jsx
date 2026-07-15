"use client";

import { useEffect, useState, use } from "react";
import { api } from "@/utils/api";

export default function NFCResolverPage({ params: paramsPromise }) {
  // Desempaquetar params usando React.use() para compatibilidad con Next.js 14/15
  const params = use(paramsPromise);
  const shortCode = params.code;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState("ACTIVE"); // ACTIVE o SUSPENDED

  // Estado del flujo de calificación
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flowStep, setFlowStep] = useState("SELECT_STARS"); // SELECT_STARS, GOOGLE_CONFIRM, COMPLAINT_FORM, COMPLETED
  const [errorMessage, setErrorMessage] = useState("");

  // Cargar branding y registrar escaneo inicial
  useEffect(() => {
    let active = true;

    async function loadBrandingAndScan() {
      try {
        const data = await api.resolver.getBranding(shortCode);
        if (!active) return;

        if (data.status === "SUSPENDED") {
          setStatus("SUSPENDED");
          setLoading(false);
          return;
        }

        setLocation(data.location || data); // Manejar payloads planos u objetos anidados
        setLoading(false);

        // Registrar métrica de escaneo en segundo plano (anónimo)
        api.resolver.recordMetric(shortCode, "SCAN").catch(console.error);
      } catch (err) {
        if (active) {
          setError(err.message || "Código no encontrado");
          setLoading(false);
        }
      }
    }

    loadBrandingAndScan();
    return () => { active = false; };
  }, [shortCode]);

  // Manejar selección de estrellas
  const handleStarClick = (selectedRating) => {
    setRating(selectedRating);
    if (selectedRating >= 4) {
      setFlowStep("GOOGLE_CONFIRM");
    } else {
      setFlowStep("COMPLAINT_FORM");
    }
  };

  // Enviar feedback positivo y redirección a Google Maps
  const handleRedirectToGoogle = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage("");

    try {
      // 1. Registrar valoración estrella (sin comentario)
      await api.resolver.submitFeedback(shortCode, rating);
      // 2. Registrar clic a Google
      await api.resolver.recordMetric(shortCode, "CLICK_GOOGLE", rating);
      
      // Redirigir directamente
      window.location.href = location.google_maps_url;
    } catch (err) {
      setErrorMessage(err.message || "Error al redireccionar.");
      setSubmitting(false);
    }
  };

  // Enviar queja interna (1-3 estrellas)
  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (comment.trim().length < 10) {
      setErrorMessage("Por favor, describe tu experiencia en al menos 10 caracteres.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      await api.resolver.submitFeedback(shortCode, rating, comment);
      setFlowStep("COMPLETED");
    } catch (err) {
      setErrorMessage(err.message || "Error al enviar comentarios.");
      setSubmitting(false);
    }
  };

  // Enlace opcional (Fuga/Escape) para 1-3 estrellas para cumplir política de Google
  const handleNegativeBypass = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.resolver.submitFeedback(shortCode, rating);
      await api.resolver.recordMetric(shortCode, "CLICK_GOOGLE", rating);
      window.location.href = location.google_maps_url;
    } catch (err) {
      window.location.href = location.google_maps_url; // Redirigir de todos modos
    }
  };

  if (loading) {
    return (
      <div className="landing-layout">
        <div className="spinner"></div>
        <p style={{ marginTop: "1rem", opacity: 0.7 }}>Cargando...</p>
      </div>
    );
  }

  if (status === "SUSPENDED") {
    return (
      <div className="landing-layout">
        <div className="landing-card fade-in">
          <div className="suspended-icon">⚠️</div>
          <h2 style={{ marginBottom: "0.75rem", fontWeight: "700" }}>Servicio Suspendido</h2>
          <p style={{ opacity: 0.8, fontSize: "0.95rem" }}>
            El servicio para este establecimiento se encuentra temporalmente inactivo. Si eres el administrador del local, comunícate con soporte.
          </p>
        </div>
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="landing-layout">
        <div className="landing-card fade-in">
          <div className="error-icon">❌</div>
          <h2 style={{ marginBottom: "0.75rem", fontWeight: "700" }}>Local no encontrado</h2>
          <p style={{ opacity: 0.8, fontSize: "0.95rem" }}>
            El código escaneado no es válido o ha expirado. Por favor, vuelve a escanear el código NFC del local.
          </p>
        </div>
      </div>
    );
  }

  // Colores dinámicos del branding del local
  const primaryColor = location.primary_color || "#3b82f6";
  const secondaryColor = location.secondary_color || "#1d4ed8";
  
  const customBrandingStyle = {
    "--local-primary": primaryColor,
    "--local-primary-hover": secondaryColor,
    "--local-primary-alpha": `${primaryColor}15`,
  };

  return (
    <div className="landing-layout" style={customBrandingStyle}>
      <div className="landing-card slide-up">
        {/* Branding Logo & Header */}
        <div className="branding-header">
          {location.logo_url ? (
            <img
              src={`http://localhost:8000${location.logo_url}`}
              alt={location.name}
              className="business-logo"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="business-logo-fallback">
              {location.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <h1 className="business-name">{location.name}</h1>
          <p className="business-subtitle">Tu opinión es muy importante para nosotros</p>
        </div>

        {/* PASO 1: Selección de estrellas */}
        {flowStep === "SELECT_STARS" && (
          <div className="step-content fade-in">
            <p className="step-prompt">¿Cómo calificarías tu experiencia hoy?</p>
            <div className="stars-container">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`star-btn ${star <= (hoverRating || rating) ? "active" : ""}`}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => handleStarClick(star)}
                  aria-label={`Calificar con ${star} estrellas`}
                >
                  ★
                </button>
              ))}
            </div>
            <p className="stars-hint">Haz clic en una estrella para comenzar</p>
          </div>
        )}

        {/* PASO 2: Confirmación de reseña positiva en Google */}
        {flowStep === "GOOGLE_CONFIRM" && (
          <div className="step-content fade-in">
            <div className="feedback-illustration">✨</div>
            <h3 className="step-title">¡Qué gran noticia!</h3>
            <p className="step-description">
              Nos alegra que hayas tenido una buena experiencia. Por favor, compártela en nuestro perfil público de Google Maps para ayudarnos a crecer.
            </p>
            
            {errorMessage && <p className="error-alert">{errorMessage}</p>}
            
            <div className="actions-stack">
              <button
                onClick={handleRedirectToGoogle}
                disabled={submitting}
                className="btn btn-primary btn-local"
              >
                {submitting ? <div className="spinner spinner-white"></div> : "Escribir reseña en Google"}
              </button>
              <button
                onClick={() => { setRating(0); setFlowStep("SELECT_STARS"); }}
                disabled={submitting}
                className="btn btn-secondary"
              >
                Cambiar calificación
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: Formulario de queja/comentario interno (1-3 estrellas) */}
        {flowStep === "COMPLAINT_FORM" && (
          <form onSubmit={handleSubmitComplaint} className="step-content fade-in">
            <h3 className="step-title">Queremos mejorar</h3>
            <p className="step-description">
              Sentimos mucho que tu experiencia no haya sido la mejor. Cuéntanos qué falló para que la gerencia pueda solucionarlo directamente.
            </p>
            
            <div className="input-group">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Escribe aquí tu queja o sugerencia (mínimo 10 caracteres)..."
                className="textarea"
                rows={4}
                maxLength={1000}
                required
                disabled={submitting}
              />
              <span className="char-counter">{comment.length}/1000</span>
            </div>

            {errorMessage && <p className="error-alert">{errorMessage}</p>}

            <div className="actions-stack">
              <button
                type="submit"
                disabled={submitting || comment.trim().length < 10}
                className="btn btn-primary btn-local"
              >
                {submitting ? <div className="spinner spinner-white"></div> : "Enviar sugerencia privada"}
              </button>
              
              <button
                type="button"
                onClick={() => { setRating(0); setComment(""); setFlowStep("SELECT_STARS"); }}
                disabled={submitting}
                className="btn btn-secondary"
              >
                Volver
              </button>
            </div>

            {/* Cumplimiento de Gating: Enlace directo y honesto a Google */}
            <div className="gating-bypass-container">
              <p>
                O si lo prefieres, puedes{" "}
                <button
                  type="button"
                  onClick={handleNegativeBypass}
                  className="bypass-link"
                  disabled={submitting}
                >
                  dejar tu opinión directamente en Google Maps
                </button>
                .
              </p>
            </div>
          </form>
        )}

        {/* PASO 4: Completado y Agradecimiento */}
        {flowStep === "COMPLETED" && (
          <div className="step-content fade-in">
            <div className="success-illustration">🙏</div>
            <h3 className="step-title">¡Muchas gracias!</h3>
            <p className="step-description">
              Tus comentarios han sido recibidos de manera 100% anónima. La gerencia revisará tu caso personalmente para asegurar que no vuelva a suceder.
            </p>
            <p style={{ fontSize: "0.85rem", opacity: 0.6, marginTop: "2rem" }}>
              Ya puedes cerrar esta ventana.
            </p>
          </div>
        )}
      </div>

      {/* CSS específico para la Landing Page (Incrustado de manera limpia en CSS variables) */}
      <style jsx global>{`
        .landing-layout {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--muted-light) / 0.4) 100%);
          padding: 1.25rem;
        }

        .landing-card {
          width: 100%;
          max-width: 440px;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 24px;
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.08);
          padding: 2.25rem 2rem;
          text-align: center;
        }

        .branding-header {
          margin-bottom: 2rem;
        }

        .business-logo {
          height: 72px;
          width: auto;
          max-width: 150px;
          object-fit: contain;
          margin-bottom: 1rem;
          border-radius: 12px;
        }

        .business-logo-fallback {
          height: 72px;
          width: 72px;
          background: var(--local-primary);
          color: white;
          font-weight: 700;
          font-size: 1.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 20px;
          margin: 0 auto 1rem;
          box-shadow: 0 4px 12px var(--local-primary-alpha);
        }

        .business-name {
          font-size: 1.35rem;
          font-weight: 700;
          color: hsl(var(--foreground));
          margin-bottom: 0.25rem;
        }

        .business-subtitle {
          font-size: 0.875rem;
          color: hsl(var(--muted));
        }

        .step-prompt {
          font-size: 1.05rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
        }

        .stars-container {
          display: flex;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .star-btn {
          font-size: 2.5rem;
          background: none;
          border: none;
          color: hsl(var(--border));
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), color 0.15s ease;
        }

        .star-btn:hover {
          transform: scale(1.2);
        }

        .star-btn.active {
          color: #ffb020;
          text-shadow: 0 0 10px rgba(255, 176, 32, 0.3);
        }

        .stars-hint {
          font-size: 0.8rem;
          color: hsl(var(--muted));
          opacity: 0.7;
        }

        .step-title {
          font-size: 1.2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .step-description {
          font-size: 0.9rem;
          color: hsl(var(--muted));
          line-height: 1.5;
          margin-bottom: 1.75rem;
        }

        .feedback-illustration, .success-illustration {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .suspended-icon, .error-icon {
          font-size: 3.5rem;
          margin-bottom: 1.25rem;
        }

        .actions-stack {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .btn-local {
          background-color: var(--local-primary);
          color: white;
        }

        .btn-local:hover:not(:disabled) {
          background-color: var(--local-primary-hover);
        }

        .textarea {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--muted-light) / 0.3);
          color: hsl(var(--foreground));
          font-family: inherit;
          font-size: 0.9rem;
          resize: none;
          transition: border-color 0.2s, background-color 0.2s;
        }

        .textarea:focus {
          border-color: var(--local-primary);
          background: hsl(var(--card));
        }

        .char-counter {
          align-self: flex-end;
          font-size: 0.75rem;
          color: hsl(var(--muted));
          margin-top: 0.25rem;
        }

        .error-alert {
          color: hsl(var(--error));
          font-size: 0.85rem;
          font-weight: 500;
          margin-bottom: 1rem;
          text-align: left;
        }

        .gating-bypass-container {
          margin-top: 1.5rem;
          font-size: 0.8rem;
          color: hsl(var(--muted));
          line-height: 1.4;
          border-top: 1px solid hsl(var(--border));
          padding-top: 1rem;
        }

        .bypass-link {
          background: none;
          border: none;
          color: var(--local-primary);
          text-decoration: underline;
          cursor: pointer;
          font-weight: 500;
          font-size: inherit;
          padding: 0;
          display: inline;
        }

        .bypass-link:hover {
          color: var(--local-primary-hover);
        }

        .spinner-white {
          border-color: rgba(255,255,255,0.2);
          border-top-color: white;
        }
      `}</style>
    </div>
  );
}
