import React, { useState } from "react";
import Star from "../atoms/Star";

export default function StarRating({ rating, onStarClick }) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      <div className="rating-stars-container">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            active={star <= (hoverRating || rating)}
            onClick={() => onStarClick(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            ariaLabel={`Calificar con ${star} estrellas`}
          />
        ))}
      </div>
      <p className="rating-stars-hint">Haz clic en una estrella para comenzar</p>
    </div>
  );
}
