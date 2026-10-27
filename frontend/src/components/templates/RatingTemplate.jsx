import React from "react";

export default function RatingTemplate({ children }) {
  return (
    <div className="rating-body-override">
      <div className="rating-card slide-up">
        {children}
      </div>
      
      {/* Footer matching Screen 1 */}
      <footer className="rating-page-footer">
        Privacy Policy <span>|</span> Contact
      </footer>
    </div>
  );
}
