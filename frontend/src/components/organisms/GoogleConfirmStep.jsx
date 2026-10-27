import React from "react";
import BusinessHeader from "../molecules/BusinessHeader";
import Button from "../atoms/Button";

export default function GoogleConfirmStep({
  location,
  submitting,
  errorMessage,
  onRedirectToGoogle,
  onClose,
  backendUrl
}) {
  return (
    <div className="step-content fade-in" style={{ width: "100%" }}>
      {/* Dynamic Business Branding */}
      <BusinessHeader 
        logoUrl={location?.logo_url} 
        businessName={location?.name} 
        backendUrl={backendUrl}
      />
      
      {/* Title */}
      <h2 className="rating-title">¡Muchas gracias por tu valoración!</h2>
      
      {/* Description */}
      <p className="rating-description">
        Nos alegra que hayas tenido una excelente experiencia. ¿Podrías compartirla en Google para ayudarnos a crecer?
      </p>
      
      {errorMessage && (
        <p className="rating-error-alert">{errorMessage}</p>
      )}
      
      {/* Buttons */}
      <div className="rating-actions-stack">
        <Button
          variant="maps"
          onClick={onRedirectToGoogle}
          disabled={submitting}
          loading={submitting}
        >
          Publicar en Google Maps
        </Button>
        
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={submitting}
        >
          Cerrar
        </Button>
      </div>
    </div>
  );
}
