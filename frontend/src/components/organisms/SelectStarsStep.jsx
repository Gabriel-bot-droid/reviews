import React from "react";
import BusinessHeader from "../molecules/BusinessHeader";
import StarRating from "../molecules/StarRating";

export default function SelectStarsStep({
  location,
  rating,
  onStarClick,
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
      
      {/* Title question */}
      <h2 className="rating-title">¿Cómo calificarías tu experiencia hoy?</h2>
      
      {/* Interactive Stars */}
      <StarRating rating={rating} onStarClick={onStarClick} />
    </div>
  );
}
