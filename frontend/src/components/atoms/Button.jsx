import React from "react";

const MapsPinIcon = () => (
  <svg 
    className="rating-maps-pin" 
    width="18" 
    height="18" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Red pin head */}
    <path 
      d="M12 2C8.13 2 5 5.13 5 9C5 13.17 10.05 20.31 11.38 21.69C11.72 22.04 12.28 22.04 12.62 21.69C13.95 20.31 19 13.17 19 9C19 5.13 15.87 2 12 2Z" 
      fill="#EA4335" 
    />
    {/* Inner white dot */}
    <circle cx="12" cy="9" r="3.5" fill="#FFFFFF" />
    {/* Yellow/Green accent arcs */}
    <path 
      d="M5.06 8.12C5.62 4.62 8.62 2 12 2C15.38 2 18.38 4.62 18.94 8.12H5.06Z" 
      fill="#FBBC05" 
      opacity="0.3"
    />
  </svg>
);

export default function Button({
  onClick,
  disabled = false,
  loading = false,
  children,
  type = "button",
  variant = "primary", // primary, secondary, maps
  ...props
}) {
  if (variant === "maps") {
    return (
      <div className="rating-btn-maps-outline">
        <button
          type={type}
          onClick={onClick}
          disabled={disabled || loading}
          className="rating-btn-maps"
          {...props}
        >
          {loading ? (
            <div className="rating-spinner" style={{ width: 16, height: 16, margin: 0, borderWidth: 2 }} />
          ) : (
            <>
              <MapsPinIcon />
              {children}
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`rating-btn rating-btn-${variant}`}
      {...props}
    >
      {loading ? (
        <div className="rating-spinner" style={{ width: 18, height: 18, margin: 0, borderWidth: 2 }} />
      ) : (
        children
      )}
    </button>
  );
}
