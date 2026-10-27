import React from "react";

export default function Star({
  active,
  onClick,
  onMouseEnter,
  onMouseLeave,
  ariaLabel
}) {
  return (
    <button
      type="button"
      className={`rating-star-btn ${active ? "active" : ""}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-label={ariaLabel}
    >
      ★
    </button>
  );
}
