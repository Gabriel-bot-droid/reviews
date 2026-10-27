import React, { useState } from "react";

export default function Logo({ logoUrl, businessName, backendUrl }) {
  const [imageError, setImageError] = useState(false);

  // Generar iniciales del negocio para el fallback
  const getInitials = (name) => {
    if (!name) return "FB";
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (!logoUrl || imageError) {
    return (
      <div className="rating-business-logo-fallback">
        {getInitials(businessName)}
      </div>
    );
  }

  // Prepara la URL completa de la imagen
  const fullUrl = logoUrl.startsWith("http") 
    ? logoUrl 
    : backendUrl 
      ? `${backendUrl}${logoUrl}` 
      : logoUrl;

  return (
    <img
      src={fullUrl}
      alt={businessName || "Business Logo"}
      className="rating-business-logo"
      onError={() => setImageError(true)}
    />
  );
}
