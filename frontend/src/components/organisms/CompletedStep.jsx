import React from "react";
import BusinessHeader from "../molecules/BusinessHeader";

export default function CompletedStep({ location, backendUrl }) {
  return (
    <div className="step-content fade-in" style={{ width: "100%" }}>
      {/* Dynamic Business Branding */}
      <BusinessHeader 
        logoUrl={location?.logo_url} 
        businessName={location?.name} 
        backendUrl={backendUrl}
      />
      
      {/* Title */}
      <h2 className="rating-title">¡Muchas gracias!</h2>
      
      {/* Description */}
      <p className="rating-description">
        Tus comentarios han sido recibidos de manera 100% anónima. Tu opinión es súper importante para nosotros y nos ayuda a mejorar.
      </p>
      
      {/* Footer Info */}
      <p style={{ fontSize: "0.85rem", opacity: 0.5, marginTop: "2rem", fontWeight: "500" }}>
        Ya puedes cerrar esta ventana.
      </p>
    </div>
  );
}
