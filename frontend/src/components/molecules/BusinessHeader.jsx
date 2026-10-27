import React, { useState } from "react";
import Logo from "../atoms/Logo";

export default function BusinessHeader({ logoUrl, businessName, backendUrl }) {
  const [hasError, setHasError] = useState(false);

  // Determinar si debemos mostrar el nombre en texto como fallback
  const showTextFallback = !logoUrl || hasError;

  return (
    <div className="rating-branding-header">
      <Logo 
        logoUrl={logoUrl} 
        businessName={businessName} 
        backendUrl={backendUrl}
        // Pasamos un callback para enterarnos si la imagen falló
        onError={() => setHasError(true)} 
      />
      <h1 className="rating-title" style={{ marginTop: "0.5rem", fontSize: "1.35rem" }}>
        {businessName}
      </h1>
    </div>
  );
}
