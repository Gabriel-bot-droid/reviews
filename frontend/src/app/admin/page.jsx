"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api, BACKEND_URL, decodeToken } from "@/utils/api";

export default function AdminPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  // Estados Generales
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, feedback, settings
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  // Estados de datos
  const [analytics, setAnalytics] = useState(null);
  const [location, setLocation] = useState(null);
  const [feedbackData, setFeedbackData] = useState({ items: [], total_items: 0, page: 1, total_pages: 1 });
  const [currentPage, setCurrentPage] = useState(1);

  // Estados del Formulario de Configuración
  const [configName, setConfigName] = useState("");
  const [configMapsUrl, setConfigMapsUrl] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Comprobar autenticación en el cliente
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/login");
      } else {
        const decoded = decodeToken(token);
        if (decoded && decoded.requires_password_change) {
          router.push("/reset-password");
        } else {
          setAuthenticated(true);
        }
      }
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
        setConfigMapsUrl(locationData.google_maps_url || "");
        if (locationData.logo_url) {
          setLogoPreview(`${BACKEND_URL}${locationData.logo_url}`);
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
        google_maps_url: configMapsUrl,
        logo_url: currentLogoUrl
      });

      setLocation(updatedLocation);
      setLogoFile(null);
      if (updatedLocation.logo_url) {
        setLogoPreview(`${BACKEND_URL}${updatedLocation.logo_url}`);
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

    const formatDate = (dateString) => {
      if (!dateString) return '';
      const [year, month, day] = dateString.split('-');
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]}`;
    };

    // Encontrar el valor máximo para escalar la gráfica de forma adaptativa
    const maxVal = Math.max(
      ...data.map(d => Math.max(d.scans, d.google_clicks, d.internal_feedbacks)),
      10 // Mínimo valor de escala 10
    );

    // Mapeo de coordenadas
    const getX = (index) => padding + (index / Math.max(1, data.length - 1)) * chartWidth;
    const getY = (value) => padding + chartHeight - (value / maxVal) * chartHeight;

    // Generar paths
    const generatePath = (key) => {
      return data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d[key])}`).join(' ');
    };

    const generateAreaPath = (key) => {
      const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d[key])}`).join(' ');
      return `${linePath} L ${getX(data.length - 1)} ${height - padding} L ${getX(0)} ${height - padding} Z`;
    };

    const scansPath = generatePath("scans");
    const clicksPath = generatePath("google_clicks");
    const feedbacksPath = generatePath("internal_feedbacks");

    const scansAreaPath = generateAreaPath("scans");
    const clicksAreaPath = generateAreaPath("google_clicks");
    const feedbacksAreaPath = generateAreaPath("internal_feedbacks");

    return (
      <div className="svg-container" style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" onMouseLeave={() => setHoveredIndex(null)}>
          <defs>
            <linearGradient id="gradient-scans" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gradient-clicks" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gradient-feedbacks" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </linearGradient>
          </defs>

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

          {/* Áreas (relleno) */}
          <path d={scansAreaPath} fill="url(#gradient-scans)" stroke="none" />
          <path d={clicksAreaPath} fill="url(#gradient-clicks)" stroke="none" />
          <path d={feedbacksAreaPath} fill="url(#gradient-feedbacks)" stroke="none" />

          {/* Línea de Escaneos (Azul) */}
          <path d={scansPath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Línea de Redirecciones (Verde) */}
          <path d={clicksPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Línea de Quejas (Naranja) */}
          <path d={feedbacksPath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Puntos de interacción */}
          {data.map((d, i) => {
            const isHovered = hoveredIndex === i;
            const zoneWidth = chartWidth / Math.max(1, data.length - 1);
            return (
              <g key={i}>
                {/* Zona de hover (columna invisible) */}
                <rect
                  x={getX(i) - zoneWidth / 2}
                  y={padding}
                  width={zoneWidth}
                  height={chartHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(i)}
                  style={{ cursor: 'pointer' }}
                />

                {/* Línea vertical en hover */}
                {isHovered && (
                  <line
                    x1={getX(i)}
                    y1={padding}
                    x2={getX(i)}
                    y2={height - padding}
                    stroke="hsl(var(--border))"
                    strokeWidth="1.5"
                    pointerEvents="none"
                  />
                )}

                <circle cx={getX(i)} cy={getY(d.scans)} r={isHovered ? "6" : "4"} fill="#3b82f6" stroke="hsl(var(--card))" strokeWidth="1.5" pointerEvents="none" />
                <circle cx={getX(i)} cy={getY(d.google_clicks)} r={isHovered ? "6" : "4"} fill="#10b981" stroke="hsl(var(--card))" strokeWidth="1.5" pointerEvents="none" />
                <circle cx={getX(i)} cy={getY(d.internal_feedbacks)} r={isHovered ? "6" : "4"} fill="#f59e0b" stroke="hsl(var(--card))" strokeWidth="1.5" pointerEvents="none" />

                {/* Labels inferiores (Fechas cortas) */}
                <text x={getX(i)} y={height - padding + 18} textAnchor="middle" fontSize="10" fill="hsl(var(--muted))" fontWeight={isHovered ? "600" : "normal"} pointerEvents="none">
                  {formatDate(d.date)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip HTML */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div
            className="chart-tooltip"
            style={{
              position: 'absolute',
              left: `calc(${(getX(hoveredIndex) / width) * 100}% + 15px)`,
              top: `calc(${(getY(data[hoveredIndex].scans) / height) * 100}% - 20px)`,
              transform: getX(hoveredIndex) > width * 0.7 ? 'translateX(calc(-100% - 30px))' : 'none',
              pointerEvents: 'none'
            }}
          >
            <div className="tooltip-title">{formatDate(data[hoveredIndex].date)}</div>
            <div className="tooltip-row tip-blue">Escaneos : {data[hoveredIndex].scans}</div>
            <div className="tooltip-row tip-green">Clics a Google : {data[hoveredIndex].google_clicks}</div>
            <div className="tooltip-row tip-orange">Quejas (1–3★) : {data[hoveredIndex].internal_feedbacks}</div>
          </div>
        )}
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
                  style={{ width: `${percentage}%`, backgroundColor: '#3b82f6' }}
                ></div>
              </div>
              <span className="bar-count">{val}</span>
            </div>
          );
        })}
        <div className="bar-total-row">
          <span className="bar-total-label">Total de valoraciones</span>
          <span className="bar-total-value">{total}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="admin-layout">
      {/* Mobile Navigation Bar (Sólo en móviles < 768px) */}
      <div className="mobile-navbar">
        <div className="mobile-brand">
          <h2 className="brand-title" style={{ fontSize: "1.2rem", margin: 0 }}>QuickFeedback</h2>
        </div>
        <button
          type="button"
          className="mobile-hamburger"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label="Abrir Menú"
        >
          {isSidebarOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Backdrop overlay para cerrar menú en móvil */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar Nav */}
      <aside className={`admin-sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div>
            <h2 className="brand-title">QuickFeedback</h2>
          </div>
        </div>

        <nav className="sidebar-menu">
          <button
            onClick={() => handleTabChange("dashboard")}
            className={`menu-item ${activeTab === "dashboard" ? "active" : ""}`}
          >
            <img src="/icon-dashboard.png" alt="" className="menu-icon" /> Panel de Control
          </button>

          <button
            onClick={() => handleTabChange("feedback")}
            className={`menu-item ${activeTab === "feedback" ? "active" : ""}`}
          >
            <img src="/icon-complaints.png" alt="" className="menu-icon" /> Historial de Quejas
          </button>

          <button
            onClick={() => handleTabChange("settings")}
            className={`menu-item ${activeTab === "settings" ? "active" : ""}`}
          >
            <img src="/icon-settings.png" alt="" className="menu-icon" /> Configuración Visual
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
            Cerrar Sesión
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
                src={`${BACKEND_URL}${location.logo_url}`}
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
                <div className="kpi-icon icon-purple">
                  <img src="/icon-star.png" alt="Calificación Promedio" style={{ width: "26px", height: "26px", objectFit: "contain" }} />
                </div>
                <div className="kpi-body">
                  <h3 className="kpi-value">
                    {analytics.summary.average_rating > 0
                      ? `${analytics.summary.average_rating.toFixed(1)} ★`
                      : "Sin notas"}
                  </h3>
                  <p className="kpi-label">Calificación Promedio</p>
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
                    <span className="legend-item"><span className="legend-dot color-green"></span> Clics (Google)</span>
                    <span className="legend-item"><span className="legend-dot color-orange"></span> Quejas (1-3★)</span>
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
                <div style={{ marginTop: "0.25rem" }}>
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
                          {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td>
                          <span className={`badge-stars ${item.rating >= 4 ? 'bg-success' : 'bg-warning'}`}>
                            {item.rating} ★
                          </span>
                        </td>
                        <td className="table-comment">{item.comment || <em style={{ opacity: 0.5 }}>Sin comentario (redirección)</em>}</td>
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
                        <td className="table-comment">{item.comment || <em style={{ opacity: 0.5 }}>Sin comentario (Redireccionado a Google Maps)</em>}</td>
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

                <div className="mobile-preview-container">
                  <div className="mobile-preview-screen">
                    {/* Replicating actual RatingTemplate and SelectStarsStep */}
                    <div style={{
                      backgroundColor: '#0f1115',
                      color: '#ffffff',
                      width: '100%',
                      height: '100%',
                      borderRadius: '28px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '1rem',
                      boxSizing: 'border-box',
                      fontFamily: 'system-ui, sans-serif'
                    }}>
                      <div style={{
                        width: '100%',
                        backgroundColor: '#16171b',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '24px',
                        boxShadow: '0 0 20px rgba(255, 179, 0, 0.05), inset 0 0 1px 1px rgba(255, 255, 255, 0.05)',
                        padding: '1.5rem 1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center'
                      }}>
                        <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          {logoPreview ? (
                            <img src={logoPreview} alt="Logo" style={{ maxHeight: '45px', maxWidth: '140px', objectFit: 'contain', marginBottom: '0.75rem' }} />
                          ) : (
                            <div style={{
                              height: '45px', width: '45px', 
                              background: 'linear-gradient(135deg, #ffb300 0%, #f59e0b 100%)',
                              color: '#000', fontWeight: 'bold', fontSize: '1.2rem',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: '12px', marginBottom: '0.75rem',
                              boxShadow: '0 4px 10px rgba(245, 158, 11, 0.3)'
                            }}>
                              {(configName || "M")[0]?.toUpperCase()}
                            </div>
                          )}
                          <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {configName || "Mi Local"}
                          </h1>
                        </div>
                        
                        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', lineHeight: '1.25' }}>
                          ¿Cómo calificarías tu experiencia hoy?
                        </h2>
                        
                        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem' }}>
                          {[1, 2, 3, 4, 5].map(s => (
                            <span key={s} style={{ fontSize: '2.2rem', color: 'rgba(255, 255, 255, 0.15)', lineHeight: 1 }}>★</span>
                          ))}
                        </div>
                      </div>
                      
                      <footer style={{ marginTop: 'auto', fontSize: '0.65rem', color: '#6b7280', letterSpacing: '0.05em' }}>
                        Privacy <span style={{ margin: '0 0.5rem', color: 'rgba(255, 255, 255, 0.12)' }}>|</span> Contact
                      </footer>
                    </div>
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

        /* Sidebar Nav - Light Theme */
        .admin-sidebar {
          width: 260px;
          border-right: 1px solid #e2e8f0;
          background-color: #ffffff;
          color: #334155;
          display: flex;
          flex-direction: column;
          padding: 1.5rem;
          position: fixed;
          top: 0;
          bottom: 0;
          left: 0;
          z-index: 10;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2.25rem;
          color: #0f172a;
        }

        .brand-logo {
          font-size: 1.75rem;
        }

        .brand-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #0f172a;
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
          color: #334155;
          font-family: inherit;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }

        .menu-icon {
          width: 26px;
          height: 26px;
          object-fit: contain;
          flex-shrink: 0;
          opacity: 0.65;
          filter: none;
          transition: all 0.15s ease;
        }

        .menu-item:hover {
          background-color: #f1f5f9;
          color: #0f172a;
        }

        .menu-item:hover .menu-icon {
          opacity: 0.8;
        }

        .menu-item.active {
          background-color: #f1f5f9;
          color: #0f172a;
          font-weight: 600;
          box-shadow: inset 3px 0 0 0 #0f172a;
        }
        
        .menu-item.active .menu-icon {
          opacity: 1;
          filter: none;
        }

        .sidebar-footer {
          border-top: 1px solid #e2e8f0;
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
          background: #f1f5f9;
          color: #0f172a;
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
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role {
          font-size: 0.75rem;
          color: #64748b;
        }

        .btn-logout {
          background: none;
          border: 1px solid #e2e8f0;
          padding: 0.5rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          color: #475569;
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
          background-color: #f8fafc;
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

        .icon-blue,
        .icon-green,
        .icon-orange,
        .icon-purple { background-color: rgba(59, 130, 246, 0.1); }

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
          gap: 0.9rem;
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

        .bar-total-row {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.5rem;
          padding-top: 0.75rem;
          border-top: 1px solid hsl(var(--border));
        }

        .bar-total-label {
          font-size: 0.8rem;
          font-weight: 500;
          color: hsl(var(--muted));
        }

        .bar-total-value {
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
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
          background: #0f1115; /* Match rating template background */
          flex: 1;
          border-radius: 28px;
          padding: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          overflow: hidden;
        }

        /* Chart Tooltip */
        .chart-tooltip {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          box-shadow: 0 4px 10px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          z-index: 10;
          min-width: 150px;
        }
        .tooltip-title {
          font-weight: 700;
          font-size: 13px;
          margin-bottom: 8px;
          color: #0f172a;
        }
        .tooltip-row {
          font-size: 12px;
          margin-bottom: 4px;
          font-weight: 500;
          background: none;
        }
        .tip-blue { color: #3b82f6; }
        .tip-green { color: #10b981; }
        .tip-orange { color: #f59e0b; }

        /* Estilos Responsivos (Mobile & Tablet) */
        .mobile-navbar {
          display: none;
          justify-content: space-between;
          align-items: center;
          padding: 0.85rem 1.25rem;
          background-color: #18181b;
          color: #ffffff;
          position: sticky;
          top: 0;
          z-index: 100;
          border-bottom: 1px solid #27272a;
        }

        .mobile-hamburger {
          background: none;
          border: 1px solid #3f3f46;
          color: #ffffff;
          font-size: 1.25rem;
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
          cursor: pointer;
        }

        .sidebar-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(2px);
          z-index: 998;
        }

        @media (max-width: 768px) {
          .mobile-navbar {
            display: flex;
          }

          .admin-layout {
            flex-direction: column;
          }

          .admin-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            z-index: 999;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: var(--shadow-lg);
          }

          .admin-sidebar.open {
            transform: translateX(0);
          }

          .admin-main {
            margin-left: 0 !important;
            padding: 1.25rem 1rem !important;
          }

          .main-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
            margin-bottom: 1.25rem;
          }

          .header-title {
            font-size: 1.35rem;
          }

          .header-subtitle {
            font-size: 0.8rem;
          }

          .kpi-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
          }

          .kpi-card {
            padding: 1rem;
            gap: 0.75rem;
          }

          .kpi-icon {
            width: 38px;
            height: 38px;
            font-size: 1.25rem;
          }

          .kpi-value {
            font-size: 1.25rem;
          }

          .kpi-label {
            font-size: 0.7rem;
          }

          .chart-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          .chart-legend {
            flex-wrap: wrap;
          }
        }

        @media (max-width: 480px) {
          .kpi-grid {
            grid-template-columns: 1fr;
          }

          .paginator {
            flex-direction: column;
            gap: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}
