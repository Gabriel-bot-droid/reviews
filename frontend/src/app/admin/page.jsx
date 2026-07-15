"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/utils/api";

export default function AdminPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  // Estados Generales
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, feedback, settings
  const [loading, setLoading] = useState(true);

  // Estados de datos
  const [analytics, setAnalytics] = useState(null);
  const [location, setLocation] = useState(null);
  const [feedbackData, setFeedbackData] = useState({ items: [], total_items: 0, page: 1, total_pages: 1 });
  const [currentPage, setCurrentPage] = useState(1);

  // Estados del Formulario de Configuración
  const [configName, setConfigName] = useState("");
  const [configPrimary, setConfigPrimary] = useState("#3b82f6");
  const [configSecondary, setConfigSecondary] = useState("#1d4ed8");
  const [configMapsUrl, setConfigMapsUrl] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Comprobar autenticación en el cliente
  useEffect(() => {
    if (!api.auth.isAuthenticated()) {
      router.push("/login");
    } else {
      setAuthenticated(true);
    }
  }, [router]);

  // Cargar datos
  useEffect(() => {
    if (!authenticated) return;

    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        // Cargar analíticas y configuración en paralelo
        const [analyticsData, locationData] = await Promise.all([
          api.admin.getAnalytics(),
          api.admin.getLocation()
        ]);

        if (!active) return;

        setAnalytics(analyticsData);
        setLocation(locationData);
        
        // Rellenar formulario
        setConfigName(locationData.name);
        setConfigPrimary(locationData.primary_color || "#3b82f6");
        setConfigSecondary(locationData.secondary_color || "#1d4ed8");
        setConfigMapsUrl(locationData.google_maps_url || "");
        if (locationData.logo_url) {
          setLogoPreview(`http://localhost:8000${locationData.logo_url}`);
        }

        // Cargar feedbacks paginados
        const fbData = await api.admin.getFeedback(currentPage, 8);
        if (active) {
          setFeedbackData(fbData);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          console.error("Error al cargar datos del dashboard:", err);
          setLoading(false);
        }
      }
    }

    loadData();
    return () => { active = false; };
  }, [authenticated, currentPage]);

  // Recargar feedbacks cuando cambia la página
  const handlePageChange = async (newPage) => {
    if (newPage < 1 || newPage > feedbackData.total_pages) return;
    setCurrentPage(newPage);
  };

  // Guardar cambios del formulario de branding/local
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveSuccess(false);
    setSaveError("");

    try {
      // 1. Subir logotipo si hay archivo seleccionado
      let currentLogoUrl = location.logo_url;
      if (logoFile) {
        const logoData = await api.admin.uploadLogo(logoFile);
        currentLogoUrl = logoData.logo_url;
      }

      // 2. Actualizar configuración textual
      const updatedLocation = await api.admin.updateLocation({
        name: configName,
        primary_color: configPrimary,
        secondary_color: configSecondary,
        google_maps_url: configMapsUrl,
        logo_url: currentLogoUrl
      });

      setLocation(updatedLocation);
      setLogoFile(null);
      if (updatedLocation.logo_url) {
        setLogoPreview(`http://localhost:8000${updatedLocation.logo_url}`);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.message || "Error al guardar la configuración.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Previsualizar logotipo al seleccionarlo
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Cerrar Sesión
  const handleLogout = () => {
    api.auth.logout();
  };

  if (!authenticated || loading) {
    return (
      <div className="admin-loading-layout">
        <div className="spinner"></div>
        <p style={{ marginTop: "1rem", opacity: 0.7, fontWeight: 500 }}>Cargando Panel...</p>
      </div>
    );
  }

  // --- Lógica del Generador de Gráfica SVG Semanal ---
  const renderWeeklyActivityChart = () => {
    if (!analytics || !analytics.weekly_activity || analytics.weekly_activity.length === 0) return null;
    
    const data = analytics.weekly_activity;
    
    // Dimensiones
    const width = 600;
    const height = 240;
    const padding = 30;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Encontrar el valor máximo para escalar la gráfica de forma adaptativa
    const maxVal = Math.max(
      ...data.map(d => Math.max(d.scans, d.google_clicks, d.internal_feedbacks)),
      10 // Mínimo valor de escala 10
    );

    // Mapeo de coordenadas
    const getX = (index) => padding + (index / (data.length - 1)) * chartWidth;
    const getY = (value) => padding + chartHeight - (value / maxVal) * chartHeight;

    // Generar paths
    const generatePath = (key) => {
      return data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d[key])}`).join(' ');
    };

    const scansPath = generatePath("scans");
    const clicksPath = generatePath("google_clicks");
    const feedbacksPath = generatePath("internal_feedbacks");

    return (
      <div className="svg-container">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = padding + chartHeight * ratio;
            const gridVal = Math.round(maxVal * (1 - ratio));
            return (
              <g key={idx} className="chart-grid-line">
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                <text x={padding - 8} y={y + 4} textAnchor="end" fontSize="10" fill="hsl(var(--muted))">{gridVal}</text>
              </g>
            );
          })}

          {/* Ejes */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="hsl(var(--border))" strokeWidth="1.5" />

          {/* Línea de Escaneos (Azul) */}
          <path d={scansPath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Línea de Redirecciones (Verde) */}
          <path d={clicksPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Línea de Quejas (Naranja) */}
          <path d={feedbacksPath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Puntos de interacción */}
          {data.map((d, i) => (
            <g key={i}>
              <circle cx={getX(i)} cy={getY(d.scans)} r="4" fill="#3b82f6" stroke="hsl(var(--card))" strokeWidth="1.5" />
              <circle cx={getX(i)} cy={getY(d.google_clicks)} r="4" fill="#10b981" stroke="hsl(var(--card))" strokeWidth="1.5" />
              <circle cx={getX(i)} cy={getY(d.internal_feedbacks)} r="4" fill="#f59e0b" stroke="hsl(var(--card))" strokeWidth="1.5" />
              {/* Labels inferiores (Fechas cortas) */}
              <text x={getX(i)} y={height - padding + 18} textAnchor="middle" fontSize="10" fill="hsl(var(--muted))">
                {d.date.substring(5)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  // --- Lógica del Gráfico SVG de Distribución de Estrellas ---
  const renderRatingsDistribution = () => {
    if (!analytics || !analytics.ratings_distribution) return null;
    
    const dist = analytics.ratings_distribution;
    // Pydantic serializa con alias: "1_star", "2_stars", etc.
    const starKeys = ["5_stars", "4_stars", "3_stars", "2_stars", "1_star"];
    const labels = ["5 estrellas", "4 estrellas", "3 estrellas", "2 estrellas", "1 estrella"];
    const colors = ["#10b981", "#10b981", "#ffb020", "#f59e0b", "#ef4444"];
    
    const total = starKeys.reduce((sum, key) => sum + (dist[key] || 0), 0);

    return (
      <div className="horizontal-bar-chart">
        {starKeys.map((key, idx) => {
          const val = dist[key] || 0;
          const percentage = total > 0 ? (val / total) * 100 : 0;
          return (
            <div key={key} className="bar-row">
              <span className="bar-label">{labels[idx]}</span>
              <div className="bar-wrapper">
                <div
                  className="bar-fill"
                  style={{ width: `${percentage}%`, backgroundColor: colors[idx] }}
                ></div>
              </div>
              <span className="bar-count">{val}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="admin-layout">
      {/* Sidebar Nav */}
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">📊</div>
          <div>
            <h2 className="brand-title">QuickFeedback</h2>
          </div>
        </div>

        <nav className="sidebar-menu">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`menu-item ${activeTab === "dashboard" ? "active" : ""}`}
          >
            <span className="menu-icon">📉</span> Panel de Control
          </button>
          
          <button
            onClick={() => setActiveTab("feedback")}
            className={`menu-item ${activeTab === "feedback" ? "active" : ""}`}
          >
            <span className="menu-icon">💬</span> Historial de Quejas
          </button>
          
          <button
            onClick={() => setActiveTab("settings")}
            className={`menu-item ${activeTab === "settings" ? "active" : ""}`}
          >
            <span className="menu-icon">⚙️</span> Configuración Visual
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">AD</div>
            <div className="user-meta">
              <p className="user-email">Administrador</p>
              <span className="user-role">Local Owner</span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-logout">
            🚪 Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main">
        {/* Header */}
        <header className="main-header">
          <div>
            <h1 className="header-title">
              {activeTab === "dashboard" && "Resumen y Estadísticas"}
              {activeTab === "feedback" && "Opiniones y Quejas de Clientes"}
              {activeTab === "settings" && "Branding y Configuración"}
            </h1>
            <p className="header-subtitle">
              {location && `${location.name} - Filtros e información resguardada bajo RLS`}
            </p>
          </div>
          <div className="header-actions">
            {location && location.logo_url && (
              <img
                src={`http://localhost:8000${location.logo_url}`}
                alt="Logo"
                className="header-logo-preview"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
          </div>
        </header>

        {/* CONTENIDO TAB 1: Dashboard de Analíticas */}
        {activeTab === "dashboard" && analytics && (
          <div className="tab-container fade-in">
            {/* Tarjetas KPI */}
            <div className="kpi-grid">
              <div className="card kpi-card">
                <div className="kpi-icon icon-blue">
                  <img src="/icon-scans.png" alt="Escaneos" style={{ width: "28px", height: "28px", objectFit: "contain" }} />
                </div>
                <div className="kpi-body">
                  <h3 className="kpi-value">{analytics.summary.total_scans}</h3>
                  <p className="kpi-label">Escaneos Totales (NFC)</p>
                </div>
              </div>

              <div className="card kpi-card">
                <div className="kpi-icon icon-green">
                  <img src="/icon-redirects.png" alt="Redirecciones" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
                </div>
                <div className="kpi-body">
                  <h3 className="kpi-value">{analytics.summary.total_redirects_google}</h3>
                  <p className="kpi-label">Redirecciones a Google</p>
                </div>
              </div>

              <div className="card kpi-card">
                <div className="kpi-icon icon-orange">
                  <img src="/icon-feedbacks.png" alt="Opiniones" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
                </div>
                <div className="kpi-body">
                  <h3 className="kpi-value">{analytics.summary.total_internal_feedbacks}</h3>
                  <p className="kpi-label">Opiniones Capturadas</p>
                </div>
              </div>

              <div className="card kpi-card">
                <span className="kpi-icon icon-purple">🎯</span>
                <div className="kpi-body">
                  <h3 className="kpi-value">{analytics.summary.gating_efficiency_percentage}%</h3>
                  <p className="kpi-label">Eficiencia del Embudo</p>
                </div>
              </div>
            </div>

            {/* Gráficos */}
            <div className="charts-grid">
              {/* Línea Temporal */}
              <div className="card chart-card">
                <div className="chart-header">
                  <div>
                    <h3 className="chart-title">Actividad de la Última Semana</h3>
                    <p className="chart-subtitle">Tráfico de escaneos y clics por día</p>
                  </div>
                  <div className="chart-legend">
                    <span className="legend-item"><span className="legend-dot color-blue"></span> Escaneos</span>
                    <span className="legend-item"><span className="legend-dot color-green"></span> Clics</span>
                    <span className="legend-item"><span className="legend-dot color-orange"></span> Quejas</span>
                  </div>
                </div>
                {renderWeeklyActivityChart()}
              </div>

              {/* Distribución */}
              <div className="card chart-card">
                <div>
                  <h3 className="chart-title">Distribución de Estrellas</h3>
                  <p className="chart-subtitle">Resumen histórico de satisfacción</p>
                </div>
                <div style={{ marginTop: "1.5rem" }}>
                  {renderRatingsDistribution()}
                </div>
              </div>
            </div>

            {/* Resumen de Quejas Recientes */}
            <div className="card table-preview-card" style={{ marginTop: "2rem" }}>
              <div className="table-header">
                <div>
                  <h3 className="chart-title">Quejas Recientes</h3>
                  <p className="chart-subtitle">Últimas opiniones privadas recopiladas</p>
                </div>
                <button onClick={() => setActiveTab("feedback")} className="btn btn-secondary btn-sm">
                  Ver todo el historial
                </button>
              </div>
              
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Valoración</th>
                      <th>Comentario del Cliente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedbackData.items.slice(0, 3).map((item) => (
                      <tr key={item.id}>
                        <td className="table-date">
                          {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </td>
                        <td>
                          <span className={`badge-stars ${item.rating >= 4 ? 'bg-success' : 'bg-warning'}`}>
                            {item.rating} ★
                          </span>
                        </td>
                        <td className="table-comment">{item.comment || <em style={{opacity: 0.5}}>Sin comentario (redirección)</em>}</td>
                      </tr>
                    ))}
                    {feedbackData.items.length === 0 && (
                      <tr>
                        <td colSpan="3" style={{ textAlign: "center", padding: "2rem", opacity: 0.5 }}>
                          Aún no hay opiniones registradas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CONTENIDO TAB 2: Historial completo de quejas (Paginado) */}
        {activeTab === "feedback" && (
          <div className="tab-container fade-in">
            <div className="card">
              <div className="table-header">
                <div>
                  <h3 className="chart-title">Historial Completo</h3>
                  <p className="chart-subtitle">
                    Mostrando opiniones {feedbackData.items.length > 0 ? (currentPage - 1) * 8 + 1 : 0} - {Math.min(currentPage * 8, feedbackData.total_items)} de {feedbackData.total_items}
                  </p>
                </div>
              </div>

              <div className="table-container" style={{ marginTop: "1rem" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha y Hora</th>
                      <th>Valoración</th>
                      <th>Comentario/Queja del Comensal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedbackData.items.map((item) => (
                      <tr key={item.id}>
                        <td className="table-date">
                          {new Date(item.created_at).toLocaleString()}
                        </td>
                        <td>
                          <span className={`badge-stars ${item.rating >= 4 ? 'bg-success' : 'bg-warning'}`}>
                            {item.rating} ★
                          </span>
                        </td>
                        <td className="table-comment">{item.comment || <em style={{opacity: 0.5}}>Sin comentario (Redireccionado a Google Maps)</em>}</td>
                      </tr>
                    ))}
                    {feedbackData.items.length === 0 && (
                      <tr>
                        <td colSpan="3" style={{ textAlign: "center", padding: "3rem", opacity: 0.5 }}>
                          No hay feedbacks para mostrar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginador */}
              {feedbackData.total_pages > 1 && (
                <div className="paginator">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="btn btn-secondary btn-sm"
                  >
                    ◀ Anterior
                  </button>
                  <span className="paginator-label">
                    Página <strong>{currentPage}</strong> de {feedbackData.total_pages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === feedbackData.total_pages}
                    className="btn btn-secondary btn-sm"
                  >
                    Siguiente ▶
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONTENIDO TAB 3: Ajustes de Local y Branding */}
        {activeTab === "settings" && location && (
          <div className="tab-container fade-in">
            <div className="settings-grid">
              {/* Formulario de ajustes */}
              <div className="card">
                <h3 className="chart-title" style={{ marginBottom: "1.5rem" }}>Branding y Enlaces</h3>
                
                <form onSubmit={handleSaveConfig}>
                  {saveSuccess && (
                    <div className="alert alert-success fade-in">
                      ¡Configuración guardada exitosamente en la base de datos!
                    </div>
                  )}

                  {saveError && (
                    <div className="alert alert-danger fade-in">
                      {saveError}
                    </div>
                  )}

                  <div className="input-group">
                    <label className="input-label" htmlFor="loc-name">Nombre Comercial</label>
                    <input
                      id="loc-name"
                      type="text"
                      className="input"
                      value={configName}
                      onChange={(e) => setConfigName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="colors-row">
                    <div className="input-group flex-1">
                      <label className="input-label" htmlFor="loc-primary">Color Primario</label>
                      <div className="color-picker-wrapper">
                        <input
                          id="loc-primary"
                          type="color"
                          className="color-input"
                          value={configPrimary}
                          onChange={(e) => setConfigPrimary(e.target.value)}
                        />
                        <input
                          type="text"
                          className="input color-text"
                          value={configPrimary.toUpperCase()}
                          onChange={(e) => setConfigPrimary(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="input-group flex-1">
                      <label className="input-label" htmlFor="loc-secondary">Color de Acento</label>
                      <div className="color-picker-wrapper">
                        <input
                          id="loc-secondary"
                          type="color"
                          className="color-input"
                          value={configSecondary}
                          onChange={(e) => setConfigSecondary(e.target.value)}
                        />
                        <input
                          type="text"
                          className="input color-text"
                          value={configSecondary.toUpperCase()}
                          onChange={(e) => setConfigSecondary(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="input-group" style={{ marginTop: "0.5rem" }}>
                    <label className="input-label" htmlFor="loc-maps">URL de Reseñas en Google Maps</label>
                    <input
                      id="loc-maps"
                      type="url"
                      className="input"
                      placeholder="https://maps.google.com/?cid=..."
                      value={configMapsUrl}
                      onChange={(e) => setConfigMapsUrl(e.target.value)}
                      required
                    />
                  </div>

                  {/* Carga de logotipo */}
                  <div className="input-group" style={{ marginTop: "0.5rem" }}>
                    <label className="input-label">Logotipo Corporativo (.png, .jpg)</label>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg"
                      ref={fileInputRef}
                      onChange={handleLogoChange}
                      style={{ display: "none" }}
                    />
                    <div className="logo-upload-box">
                      {logoPreview ? (
                        <div className="logo-uploaded-preview">
                          <img src={logoPreview} alt="Logotipo comercial" />
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => fileInputRef.current.click()}
                          >
                            Reemplazar Imagen
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => fileInputRef.current.click()}
                        >
                          Seleccionar Archivo
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saveLoading}
                    className="btn btn-primary"
                    style={{ marginTop: "1.5rem" }}
                  >
                    {saveLoading ? <div className="spinner spinner-white"></div> : "Guardar Cambios"}
                  </button>
                </form>
              </div>

              {/* Vista Previa Móvil */}
              <div className="card preview-card-outer">
                <h3 className="chart-title" style={{ marginBottom: "0.5rem" }}>Vista Previa en Tiempo Real</h3>
                <p className="chart-subtitle" style={{ marginBottom: "1.5rem" }}>Así se verá la pantalla en los móviles de tus clientes</p>
                
                <div
                  className="mobile-preview-container"
                  style={{
                    "--preview-primary": configPrimary,
                    "--preview-secondary": configSecondary
                  }}
                >
                  <div className="mobile-preview-screen">
                    <div className="preview-logo-wrapper">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="preview-logo" />
                      ) : (
                        <div className="preview-logo-placeholder">Fallback</div>
                      )}
                    </div>
                    <h4 className="preview-name">{configName || "Mi Local"}</h4>
                    <p className="preview-sub">Tu opinión es muy importante para nosotros</p>
                    
                    <div className="preview-stars">
                      {[1,2,3,4,5].map(s => (
                        <span key={s} className="preview-star">★</span>
                      ))}
                    </div>
                    
                    <button type="button" className="btn-preview-action">
                      Continuar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Estilos específicos de la sección de administración */}
      <style jsx global>{`
        .admin-layout {
          min-height: 100vh;
          display: flex;
          background: #ffffff;
          color: #0f172a;
          /* Forzar variables de Light Theme localmente en el backoffice */
          --background: 0 0% 100%;
          --foreground: 220 40% 12%;
          --card: 0 0% 100%;
          --card-foreground: 220 40% 15%;
          --border: 220 15% 90%;
          --muted: 220 10% 45%;
          --muted-light: 220 10% 95%;
        }

        /* Loading Layout */
        .admin-loading-layout {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          color: #0f172a;
        }

        /* Sidebar Nav - Black Background */
        .admin-sidebar {
          width: 260px;
          border-right: 1px solid #27272a;
          background-color: #111111;
          color: #ffffff;
          display: flex;
          flex-direction: column;
          padding: 1.5rem;
          position: fixed;
          top: 0;
          bottom: 0;
          left: 0;
          z-index: 10;
          /* Forzar variables de Dark Theme en el Sidebar */
          --foreground: 210 20% 96%;
          --border: 220 20% 16%;
          --card: 220 30% 9%;
          --muted: 220 10% 65%;
          --muted-light: 220 20% 13%;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2.25rem;
          color: #ffffff;
        }

        .brand-logo {
          font-size: 1.75rem;
        }

        .brand-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #ffffff;
        }

        .brand-badge {
          font-size: 0.7rem;
          font-weight: 600;
          color: #60a5fa;
          background-color: rgba(96, 165, 250, 0.1);
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
        }

        .sidebar-menu {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
          flex: 1;
        }

        .menu-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          background: none;
          border: none;
          color: #a1a1aa;
          font-family: inherit;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }

        .menu-item:hover {
          background-color: #27272a;
          color: #ffffff;
        }

        .menu-item.active {
          background-color: #2563eb;
          color: #ffffff;
          font-weight: 600;
        }

        .sidebar-footer {
          border-top: 1px solid #27272a;
          padding-top: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #27272a;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.85rem;
        }

        .user-meta {
          flex: 1;
          min-width: 0;
        }

        .user-email {
          font-size: 0.85rem;
          font-weight: 600;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role {
          font-size: 0.75rem;
          color: #a1a1aa;
        }

        .btn-logout {
          background: none;
          border: 1px solid #27272a;
          padding: 0.5rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          color: #ffffff;
          cursor: pointer;
          transition: background-color 0.15s;
        }

        .btn-logout:hover {
          background-color: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        /* Main View */
        .admin-main {
          margin-left: 260px;
          flex: 1;
          min-width: 0;
          padding: 2.25rem;
          background-color: #ffffff;
          min-height: 100vh;
        }

        .main-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          border-bottom: 1px solid hsl(var(--border));
          padding-bottom: 1.25rem;
        }

        .header-title {
          font-size: 1.6rem;
          font-weight: 700;
        }

        .header-subtitle {
          font-size: 0.9rem;
          color: hsl(var(--muted));
        }

        .header-logo-preview {
          height: 40px;
          width: auto;
          border-radius: 6px;
          border: 1px solid hsl(var(--border));
        }

        /* KPI Cards Grid */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.25rem;
          margin-bottom: 1.75rem;
        }

        .kpi-card {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          padding: 1.25rem 1.5rem;
        }

        .kpi-icon {
          font-size: 1.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 12px;
        }

        .icon-blue { background-color: rgba(59, 130, 246, 0.1); }
        .icon-green { background-color: rgba(16, 185, 129, 0.1); }
        .icon-orange { background-color: rgba(245, 158, 11, 0.1); }
        .icon-purple { background-color: rgba(139, 92, 246, 0.1); }

        .kpi-body {
          display: flex;
          flex-direction: column;
        }

        .kpi-value {
          font-size: 1.5rem;
          font-weight: 700;
          line-height: 1.1;
        }

        .kpi-label {
          font-size: 0.75rem;
          color: hsl(var(--muted));
          font-weight: 500;
          margin-top: 0.25rem;
        }

        /* Charts Section */
        .charts-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
        }

        @media (max-width: 1024px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
        }

        .chart-card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .chart-title {
          font-size: 1.1rem;
          font-weight: 700;
        }

        .chart-subtitle {
          font-size: 0.8rem;
          color: hsl(var(--muted));
        }

        .chart-legend {
          display: flex;
          gap: 0.75rem;
        }

        .legend-item {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: hsl(var(--muted));
        }

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        .color-blue { background-color: #3b82f6; }
        .color-green { background-color: #10b981; }
        .color-orange { background-color: #f59e0b; }

        .svg-container {
          width: 100%;
          height: 100%;
          min-height: 180px;
          display: flex;
          align-items: center;
        }

        /* Ratings Distribution Chart (Vertical Rows) */
        .horizontal-bar-chart {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .bar-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.85rem;
        }

        .bar-label {
          width: 80px;
          font-weight: 500;
          color: hsl(var(--muted));
        }

        .bar-wrapper {
          flex: 1;
          height: 8px;
          background-color: hsl(var(--muted-light));
          border-radius: 4px;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.4s ease;
        }

        .bar-count {
          width: 24px;
          text-align: right;
          font-weight: 600;
        }

        /* Tables */
        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .table-container {
          width: 100%;
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .data-table th, .data-table td {
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          border-bottom: 1px solid hsl(var(--border));
        }

        .data-table th {
          font-weight: 600;
          color: hsl(var(--muted));
          background-color: hsl(var(--muted-light) / 0.2);
        }

        .table-date {
          font-weight: 500;
          color: hsl(var(--muted));
          white-space: nowrap;
        }

        .table-comment {
          max-width: 400px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .badge-stars {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.125rem 0.5rem;
          border-radius: 6px;
          color: white;
          display: inline-block;
        }

        .bg-success { background-color: #10b981; }
        .bg-warning { background-color: #ffb020; }

        /* Paginator */
        .paginator {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 1.5rem;
          margin-top: 1.5rem;
        }

        .paginator-label {
          font-size: 0.85rem;
          color: hsl(var(--muted));
        }

        /* Settings configuration screen */
        .settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }

        @media (max-width: 900px) {
          .settings-grid {
            grid-template-columns: 1fr;
          }
        }

        .colors-row {
          display: flex;
          gap: 1rem;
        }

        .flex-1 { flex: 1; }

        .color-picker-wrapper {
          display: flex;
          border: 1px solid hsl(var(--border));
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .color-input {
          width: 40px;
          height: 100%;
          border: none;
          padding: 0;
          cursor: pointer;
          background: none;
        }

        .color-text {
          border: none !important;
          border-radius: 0 !important;
          background: none !important;
        }

        .logo-upload-box {
          border: 2px dashed hsl(var(--border));
          border-radius: 12px;
          padding: 1.25rem;
          text-align: center;
          background: hsl(var(--muted-light) / 0.1);
        }

        .logo-uploaded-preview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
        }

        .logo-uploaded-preview img {
          max-height: 48px;
          width: auto;
          object-fit: contain;
          border-radius: 4px;
        }

        .alert {
          border-radius: 10px;
          padding: 0.75rem 1rem;
          margin-bottom: 1.25rem;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .alert-success {
          background-color: hsl(var(--success) / 0.1);
          border: 1px solid hsl(var(--success) / 0.2);
          color: hsl(var(--success));
        }

        .alert-danger {
          background-color: hsl(var(--error) / 0.1);
          border: 1px solid hsl(var(--error) / 0.2);
          color: hsl(var(--error));
        }

        /* Mobile Live Preview Outer card */
        .preview-card-outer {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .mobile-preview-container {
          background: #0f172a;
          border: 10px solid #1e293b;
          border-radius: 36px;
          width: 250px;
          height: 450px;
          display: flex;
          box-shadow: var(--shadow-lg);
          padding: 5px;
        }

        .mobile-preview-screen {
          background: hsl(var(--background));
          flex: 1;
          border-radius: 28px;
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          overflow: hidden;
        }

        .preview-logo-wrapper {
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }

        .preview-logo {
          height: 36px;
          width: auto;
          border-radius: 6px;
        }

        .preview-logo-placeholder {
          height: 36px;
          width: 36px;
          background: var(--preview-primary);
          color: white;
          border-radius: 8px;
          font-weight: bold;
          font-size: 0.6rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .preview-name {
          font-size: 0.95rem;
          font-weight: 700;
        }

        .preview-sub {
          font-size: 0.65rem;
          color: hsl(var(--muted));
          margin-top: 0.125rem;
        }

        .preview-stars {
          display: flex;
          gap: 0.15rem;
          margin: 1.5rem 0 0.5rem;
        }

        .preview-star {
          font-size: 1.25rem;
          color: #ffb020;
        }

        .btn-preview-action {
          width: 100%;
          background-color: var(--preview-primary);
          color: white;
          border: none;
          font-family: inherit;
          font-size: 0.75rem;
          font-weight: bold;
          padding: 0.5rem;
          border-radius: 6px;
          margin-top: auto;
          cursor: default;
        }
      `}</style>
    </div>
  );
}
