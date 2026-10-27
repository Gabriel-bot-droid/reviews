import React from "react";

export default function TextArea({
  value,
  onChange,
  placeholder = "Escribe aquí tu comentario...",
  maxLength = 1000,
  disabled = false,
  required = false,
  rows = 4
}) {
  return (
    <div className="rating-textarea-wrapper">
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        required={required}
        rows={rows}
        className="rating-textarea"
      />
      <span className="rating-char-counter">
        {value.length}/{maxLength}
      </span>
    </div>
  );
}
