import React from "react";
import BusinessHeader from "../molecules/BusinessHeader";
import TextArea from "../atoms/TextArea";
import Button from "../atoms/Button";

export default function ComplaintFormStep({
  location,
  comment,
  onCommentChange,
  submitting,
  errorMessage,
  onSubmit,
  onGoBack,
  onNegativeBypass,
  backendUrl
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  const isSubmitDisabled = comment.trim().length < 10 || submitting;

  return (
    <form onSubmit={handleSubmit} className="step-content fade-in" style={{ width: "100%" }}>
      {/* Dynamic Business Branding */}
      <BusinessHeader
        logoUrl={location?.logo_url}
        businessName={location?.name}
        backendUrl={backendUrl}
      />

      {/* Title */}
      <h2 className="rating-title">Queremos mejorar</h2>

      {/* Description */}
      <p className="rating-description">
        Sentimos mucho que tu experiencia no haya sido la mejor. Cuéntanos qué falló para que podamos mejorar.
      </p>

      {/* TextArea with Char Counter */}
      <TextArea
        value={comment}
        onChange={(e) => onCommentChange(e.target.value)}
        placeholder="Escribe aquí tu queja o sugerencia (mínimo 10 caracteres)..."
        maxLength={1000}
        disabled={submitting}
        required
      />

      {errorMessage && (
        <p className="rating-error-alert">{errorMessage}</p>
      )}

      {/* Buttons */}
      <div className="rating-actions-stack">
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitDisabled}
          loading={submitting}
        >
          Enviar sugerencia
        </Button>

        <Button
          type="button"
          variant="secondary"
          onClick={onGoBack}
          disabled={submitting}
        >
          Volver
        </Button>
      </div>

      {/* Google Maps Bypass Link */}
      <div className="rating-bypass-container">
        <span>O si lo prefieres, puedes </span>
        <button
          type="button"
          onClick={onNegativeBypass}
          className="rating-bypass-link"
          disabled={submitting}
        >
          dejar tu opinión directamente en Google Maps
        </button>
        <span>.</span>
      </div>
    </form>
  );
}
