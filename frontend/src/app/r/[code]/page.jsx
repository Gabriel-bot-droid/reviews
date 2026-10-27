"use client";

import { useEffect, useState, use } from "react";
import { api, BACKEND_URL } from "@/utils/api";
import "./rating.css";

import RatingTemplate from "@/components/templates/RatingTemplate";
import SelectStarsStep from "@/components/organisms/SelectStarsStep";
import GoogleConfirmStep from "@/components/organisms/GoogleConfirmStep";
import ComplaintFormStep from "@/components/organisms/ComplaintFormStep";
import CompletedStep from "@/components/organisms/CompletedStep";
import StatusCard from "@/components/organisms/StatusCard";

export default function NFCResolverPage({ params: paramsPromise }) {
  // Desempaquetar params usando React.use() para compatibilidad con Next.js 14/15/16
  const params = use(paramsPromise);
  const shortCode = params.code;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState("ACTIVE"); // ACTIVE o SUSPENDED

  // Estado del flujo de calificación
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flowStep, setFlowStep] = useState("SELECT_STARS"); // SELECT_STARS, GOOGLE_CONFIRM, COMPLAINT_FORM, COMPLETED
  const [errorMessage, setErrorMessage] = useState("");

  // Cargar branding y registrar escaneo inicial
  useEffect(() => {
    let active = true;

    async function loadBrandingAndScan() {
      try {
        const data = await api.resolver.getBranding(shortCode);
        if (!active) return;

        if (data.status === "SUSPENDED") {
          setStatus("SUSPENDED");
          setLoading(false);
          return;
        }

        setLocation(data.location || data); // Manejar payloads planos u objetos anidados
        setLoading(false);

        // Registrar métrica de escaneo en segundo plano (anónimo)
        api.resolver.recordMetric(shortCode, "SCAN").catch(console.error);
      } catch (err) {
        if (active) {
          setError(err.message || "Código no encontrado");
          setLoading(false);
        }
      }
    }

    loadBrandingAndScan();
    return () => { active = false; };
  }, [shortCode]);

  // Manejar selección de estrellas
  const handleStarClick = (selectedRating) => {
    setRating(selectedRating);
    if (selectedRating >= 4) {
      setFlowStep("GOOGLE_CONFIRM");
    } else {
      setFlowStep("COMPLAINT_FORM");
    }
  };

  // Enviar feedback positivo y redirección a Google Maps
  const handleRedirectToGoogle = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage("");

    try {
      // 1. Registrar valoración estrella (sin comentario)
      await api.resolver.submitFeedback(shortCode, rating);
      // 2. Registrar clic a Google
      await api.resolver.recordMetric(shortCode, "CLICK_GOOGLE", rating);
      
      // Redirigir directamente
      window.location.href = location.google_maps_url;
    } catch (err) {
      setErrorMessage(err.message || "Error al redireccionar.");
      setSubmitting(false);
    }
  };

  // Enviar queja interna (1-3 estrellas)
  const handleSubmitComplaint = async () => {
    if (submitting) return;

    if (comment.trim().length < 10) {
      setErrorMessage("Por favor, describe tu experiencia en al menos 10 caracteres.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      await api.resolver.submitFeedback(shortCode, rating, comment);
      setFlowStep("COMPLETED");
    } catch (err) {
      setErrorMessage(err.message || "Error al enviar comentarios.");
      setSubmitting(false);
    }
  };

  // Enlace opcional (Fuga/Escape) para 1-3 estrellas para cumplir política de Google
  const handleNegativeBypass = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.resolver.submitFeedback(shortCode, rating);
      await api.resolver.recordMetric(shortCode, "CLICK_GOOGLE", rating);
      window.location.href = location.google_maps_url;
    } catch (err) {
      window.location.href = location.google_maps_url; // Redirigir de todos modos
    }
  };

  // Volver a la calificación de estrellas
  const handleGoBack = () => {
    setRating(0);
    setComment("");
    setFlowStep("SELECT_STARS");
  };

  // Cerrar y transicionar
  const handleClose = () => {
    try {
      window.close();
    } catch (e) {
      // Bloqueado
    }
    setFlowStep("COMPLETED");
  };

  // Renderizado condicional según estado global de carga / errores
  if (loading) {
    return (
      <RatingTemplate>
        <StatusCard type="loading" />
      </RatingTemplate>
    );
  }

  if (status === "SUSPENDED") {
    return (
      <RatingTemplate>
        <StatusCard type="suspended" />
      </RatingTemplate>
    );
  }

  if (error || !location) {
    return (
      <RatingTemplate>
        <StatusCard type="error" message={error} />
      </RatingTemplate>
    );
  }

  return (
    <RatingTemplate>
      {flowStep === "SELECT_STARS" && (
        <SelectStarsStep
          location={location}
          rating={rating}
          onStarClick={handleStarClick}
          backendUrl={BACKEND_URL}
        />
      )}

      {flowStep === "GOOGLE_CONFIRM" && (
        <GoogleConfirmStep
          location={location}
          submitting={submitting}
          errorMessage={errorMessage}
          onRedirectToGoogle={handleRedirectToGoogle}
          onClose={handleClose}
          backendUrl={BACKEND_URL}
        />
      )}

      {flowStep === "COMPLAINT_FORM" && (
        <ComplaintFormStep
          location={location}
          comment={comment}
          onCommentChange={setComment}
          submitting={submitting}
          errorMessage={errorMessage}
          onSubmit={handleSubmitComplaint}
          onGoBack={handleGoBack}
          onNegativeBypass={handleNegativeBypass}
          backendUrl={BACKEND_URL}
        />
      )}

      {flowStep === "COMPLETED" && (
        <CompletedStep
          location={location}
          backendUrl={BACKEND_URL}
        />
      )}
    </RatingTemplate>
  );
}
