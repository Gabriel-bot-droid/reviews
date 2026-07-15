import "./globals.css";

export const metadata = {
  title: "QuickFeedback NFC - Reputación y Reseñas de Clientes",
  description: "Canaliza las reseñas públicas en Google Maps y captura quejas en privado mediante tags inteligentes NFC.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  );
}
