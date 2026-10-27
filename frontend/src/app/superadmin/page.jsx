"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, decodeToken, BACKEND_URL } from "@/utils/api";

export default function SuperadminPage() {
  const router = useRouter();

  // Estados de carga e inquilinos
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTenants, setTotalTenants] = useState(0);

  // Estados del modal de aprovisionamiento
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newShortCode, setNewShortCode] = useState("");
  const [newGoogleMapsUrl, setNewGoogleMapsUrl] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [successData, setSuccessData] = useState(null);

  // Estados del modal de edición
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTenantId, setEditTenantId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editGoogleMapsUrl, setEditGoogleMapsUrl] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Verificación de seguridad del Súper Administrador
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/login");
        return;
      }
      const decoded = decodeToken(token);
      if (!decoded || decoded.role !== "superadmin") {
        localStorage.removeItem("admin_token");
        router.push("/login");
      }
    }
  }, [router]);

  // Cargar inquilinos paginados
  const fetchTenants = async (page) => {
    setLoading(true);
    try {
      const res = await api.superadmin.getTenants(page, 8);
      setTenants(res.items);
      setTotalPages(res.pages);
      setTotalTenants(res.total);
      setCurrentPage(res.page);
    } catch (err) {
      console.error("Error al cargar locales:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants(1);
  }, []);

  // Manejar aprovisionamiento de nuevo local
  const handleCreateTenant = async (e) => {
    e.preventDefault();
    if (createLoading) return;

    setCreateLoading(true);
    setCreateError("");
    setSuccessData(null);

    const payload = {
      name: newName,
      email: newEmail,
      short_code: newShortCode.trim() ? newShortCode : null,
      google_maps_url: newGoogleMapsUrl.trim() ? newGoogleMapsUrl : null
    };

    try {
      const res = await api.superadmin.createTenant(payload);
      setSuccessData(res);
      // Limpiar formulario
      setNewName("");
      setNewEmail("");
      setNewShortCode("");
      setNewGoogleMapsUrl("");
      // Recargar lista
      fetchTenants(1);
    } catch (err) {
      setCreateError(err.message || "Error al aprovisionar inquilino.");
    } finally {
      setCreateLoading(false);
    }
  };

  // Abrir modal de edición
  const openEditModal = (tenant) => {
    setEditTenantId(tenant.id);
    setEditName(tenant.name);
    setEditGoogleMapsUrl(tenant.google_maps_url || "");
    setEditError("");
    setResetPasswordSuccess(null);
    setIsEditModalOpen(true);
  };

  // Restablecer contraseña asistida
  const handleResetPassword = async () => {
    if (!window.confirm("¿Estás seguro de que deseas restablecer la contraseña de este negocio? Se generará una contraseña temporal nueva.")) {
      return;
    }

    setResetLoading(true);
    setEditError("");
    setResetPasswordSuccess(null);

    try {
      const res = await api.superadmin.resetTenantPassword(editTenantId);
      setResetPasswordSuccess(res.temporary_password);
    } catch (err) {
      setEditError(err.message || "Error al restablecer la contraseña.");
    } finally {
      setResetLoading(false);
    }
  };

  // Guardar edición
  const handleUpdateLocation = async (e) => {
    e.preventDefault();
    if (editLoading) return;

    setEditLoading(true);
    setEditError("");

    const payload = {
      name: editName,
      google_maps_url: editGoogleMapsUrl.trim() ? editGoogleMapsUrl : "https://maps.google.com"
    };

    try {
      await api.superadmin.updateTenantLocation(editTenantId, payload);
      // Recargar lista y cerrar modal
      fetchTenants(currentPage);
      setIsEditModalOpen(false);
    } catch (err) {
      setEditError(err.message || "Error al actualizar local.");
    } finally {
      setEditLoading(false);
    }
  };

  // Manejar el toggle de activación/suspensión
  const handleToggleStatus = async (tenantId, currentStatus) => {
    try {
      // Actualización optimista en interfaz
      setTenants(prev =>
        prev.map(t => t.id === tenantId ? { ...t, is_active: !currentStatus } : t)
      );

      await api.superadmin.updateTenantStatus(tenantId, !currentStatus);
    } catch (err) {
      alert("Error al actualizar estado del local: " + err.message);
      // Revertir cambio en interfaz si falla
      setTenants(prev =>
        prev.map(t => t.id === tenantId ? { ...t, is_active: currentStatus } : t)
      );
    }
  };

  // Copiar al portapapeles la contraseña temporal
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("¡Contraseña copiada al portapapeles!");
  };

  return (
    <div className="superadmin-layout">
      {/* Barra de navegación superior */}
      <nav className="superadmin-navbar">
        <div className="navbar-brand">
          <span className="navbar-logo">👑</span>
          <div>
            <h1 className="navbar-title">Súper Administrador</h1>
            <p className="navbar-subtitle">QuickFeedback NFC Global Panel</p>
          </div>
        </div>
        <button onClick={api.auth.logout} className="btn-logout">
          Cerrar Sesión
        </button>
      </nav>

      {/* Cuerpo principal */}
      <main className="superadmin-content">
        <div className="content-header">
          <div>
            <h2 className="section-title">Negocios Registrados</h2>
            <p className="section-subtitle">
              Gestiona los inquilinos SaaS, aprovisiona nuevas cuentas y controla la activación por pago.
            </p>
          </div>
          <button onClick={() => { setIsModalOpen(true); setSuccessData(null); setCreateError(""); }} className="btn-provision">
            ➕ Aprovisionar Negocio
          </button>
        </div>

        {/* Tarjetas KPI */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <span className="kpi-icon bg-purple">🏢</span>
            <div>
              <p className="kpi-label">Locales Totales</p>
              <h3 className="kpi-value">{totalTenants}</h3>
            </div>
          </div>
          <div className="kpi-card">
            <span className="kpi-icon bg-green">🟢</span>
            <div>
              <p className="kpi-label">Locales Activos</p>
              <h3 className="kpi-value">{tenants.filter(t => t.is_active).length}</h3>
            </div>
          </div>
          <div className="kpi-card">
            <span className="kpi-icon bg-red">🔴</span>
            <div>
              <p className="kpi-label">Locales Suspendidos</p>
              <h3 className="kpi-value">{tenants.filter(t => !t.is_active).length}</h3>
            </div>
          </div>
        </div>

        {/* Contenedor de la Tabla */}
        <div className="table-wrapper">
          {loading ? (
            <div className="table-loader">
              <div className="spinner"></div>
              <p>Cargando información del servidor...</p>
            </div>
          ) : tenants.length === 0 ? (
            <div className="table-empty">
              <p>No se encontraron locales registrados en el sistema.</p>
            </div>
          ) : (
            <>
              <table className="tenants-table">
                <thead>
                  <tr>
                    <th>Nombre de Negocio</th>
                    <th>Email Dueño</th>
                    <th>Código NFC</th>
                    <th>Fecha Registro</th>
                    <th>Estado de Cuenta</th>
                    <th>Embudo NFC</th>
                    <th style={{ textAlign: "right" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="table-row">
                      <td className="font-bold">{tenant.name}</td>
                      <td>{tenant.admin_email || <span className="text-muted">Sin registrar</span>}</td>
                      <td>
                        <span className="badge badge-code">/{tenant.short_code}</span>
                      </td>
                      <td className="text-muted">
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="status-container">
                          <span className={`badge ${tenant.is_active ? "badge-active" : "badge-suspended"}`}>
                            {tenant.is_active ? "Activo" : "Suspendido"}
                          </span>
                          <label className="switch">
                            <input
                              type="checkbox"
                              checked={tenant.is_active}
                              onChange={() => handleToggleStatus(tenant.id, tenant.is_active)}
                            />
                            <span className="slider round"></span>
                          </label>
                        </div>
                      </td>
                      <td>
                        <a
                          href={`/r/${tenant.short_code}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-view"
                        >
                          Probar Vista 🌐
                        </a>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          onClick={() => openEditModal(tenant)}
                          className="btn-edit"
                          style={{
                            background: "rgba(59, 130, 246, 0.1)",
                            color: "#3b82f6",
                            border: "1px solid rgba(59, 130, 246, 0.2)",
                            borderRadius: "8px",
                            padding: "0.4rem 0.8rem",
                            fontSize: "0.85rem",
                            fontWeight: "500",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                        >
                          Editar ✏️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => fetchTenants(currentPage - 1)}
                    className="pagination-btn"
                  >
                    ◀ Anterior
                  </button>
                  <span className="pagination-info">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => fetchTenants(currentPage + 1)}
                    className="pagination-btn"
                  >
                    Siguiente ▶
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Modal de Aprovisionamiento */}
      {isModalOpen && (
        <div className="modal-overlay fade-in">
          <div className="modal-container scale-up">
            <div className="modal-header">
              <h3 className="modal-title">Aprovisionar Nuevo Inquilino (SaaS)</h3>
              <button onClick={() => setIsModalOpen(false)} className="btn-close">
                ❌
              </button>
            </div>

            {!successData ? (
              <form onSubmit={handleCreateTenant}>
                {createError && (
                  <div className="modal-error-card">
                    <span>⚠️</span>
                    <p>{createError}</p>
                  </div>
                )}

                <div className="input-group">
                  <label className="input-label" htmlFor="business_name">
                    Nombre del Negocio
                  </label>
                  <input
                    id="business_name"
                    type="text"
                    required
                    placeholder="Ej. Cafetería Los Andes"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="modal-input"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label" htmlFor="owner_email">
                    Correo del Propietario (Login Admin)
                  </label>
                  <input
                    id="owner_email"
                    type="email"
                    required
                    placeholder="Ej. administrador@andes.cl"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="modal-input"
                  />
                </div>

                <div className="input-group" style={{ marginBottom: "2rem" }}>
                  <label className="input-label" htmlFor="custom_shortcode">
                    Código Corto NFC (Opcional)
                  </label>
                  <input
                    id="custom_shortcode"
                    type="text"
                    placeholder="Ej. losandes (Dejar vacío para autogenerar)"
                    value={newShortCode}
                    onChange={(e) => setNewShortCode(e.target.value)}
                    className="modal-input"
                  />
                  <p className="input-tip">
                    Esto definirá la URL de redirección: reviews.com/r/losandes
                  </p>
                </div>

                <div className="input-group" style={{ marginBottom: "2rem" }}>
                  <label className="input-label" htmlFor="custom_google_maps">
                    URL de Reseñas en Google Maps (Opcional)
                  </label>
                  <input
                    id="custom_google_maps"
                    type="url"
                    placeholder="https://maps.google.com/?cid=..."
                    value={newGoogleMapsUrl}
                    onChange={(e) => setNewGoogleMapsUrl(e.target.value)}
                    className="modal-input"
                  />
                  <p className="input-tip">
                    El enlace directo a la ficha del local para la redirección de 4 y 5 estrellas.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={createLoading}
                  className="btn btn-primary btn-block"
                >
                  {createLoading ? <div className="spinner spinner-white"></div> : "Generar Cuenta y Local"}
                </button>
              </form>
            ) : (
              <div className="success-panel fade-in">
                <div className="success-header">
                  <span className="success-icon">🎉</span>
                  <h4 className="success-title font-bold">¡Aprovisionamiento Completado!</h4>
                  <p className="success-subtitle">
                    Guarda estas credenciales iniciales de forma segura. La contraseña no se volverá a mostrar.
                  </p>
                </div>

                <div className="credentials-card">
                  <div className="cred-row">
                    <span className="cred-label">Código NFC:</span>
                    <span className="badge badge-code">/{successData.short_code}</span>
                  </div>
                  <div className="cred-row">
                    <span className="cred-label">Email Acceso:</span>
                    <span className="font-bold">{successData.email}</span>
                  </div>
                  <div className="cred-row">
                    <span className="cred-label">Contraseña Temporal:</span>
                    <div className="copy-container">
                      <span className="font-bold password-text">{successData.temporary_password}</span>
                      <button
                        onClick={() => copyToClipboard(successData.temporary_password)}
                        type="button"
                        className="btn-copy"
                      >
                        Copiar 📋
                      </button>
                    </div>
                  </div>
                </div>

                <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary btn-block">
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="modal-overlay fade-in">
          <div className="modal-container scale-up">
            <div className="modal-header">
              <h3 className="modal-title">Editar Datos del Local</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="btn-close">
                ❌
              </button>
            </div>

            <form onSubmit={handleUpdateLocation}>
              {editError && (
                <div className="modal-error-card">
                  <span>⚠️</span>
                  <p>{editError}</p>
                </div>
              )}

              {resetPasswordSuccess && (
                <div className="success-panel fade-in" style={{ padding: "1.25rem", marginBottom: "1.5rem", borderRadius: "12px", background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
                  <div className="success-header" style={{ marginBottom: "0.75rem" }}>
                    <h4 className="success-title font-bold" style={{ color: "#4ade80", fontSize: "0.95rem" }}>🔑 ¡Contraseña Restablecida con Éxito!</h4>
                    <p className="success-subtitle" style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Comparte esta nueva credencial temporal con tu cliente.</p>
                  </div>
                  <div className="credentials-card" style={{ background: "rgba(0, 0, 0, 0.2)", padding: "0.75rem", borderRadius: "8px" }}>
                    <div className="cred-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="cred-label" style={{ fontSize: "0.85rem" }}>Clave Temporal:</span>
                      <div className="copy-container" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <span className="font-bold password-text" style={{ color: "#f1f5f9", fontSize: "0.9rem" }}>{resetPasswordSuccess}</span>
                        <button
                          onClick={() => copyToClipboard(resetPasswordSuccess)}
                          type="button"
                          className="btn-copy"
                          style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                        >
                          Copiar 📋
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="input-group">
                <label className="input-label" htmlFor="edit_business_name">
                  Nombre Comercial del Local
                </label>
                <input
                  id="edit_business_name"
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="modal-input"
                />
              </div>

              <div className="input-group" style={{ marginBottom: "2rem" }}>
                <label className="input-label" htmlFor="edit_google_maps">
                  URL de Reseñas en Google Maps
                </label>
                <input
                  id="edit_google_maps"
                  type="url"
                  required
                  placeholder="https://maps.google.com/?cid=..."
                  value={editGoogleMapsUrl}
                  onChange={(e) => setEditGoogleMapsUrl(e.target.value)}
                  className="modal-input"
                />
                <p className="input-tip">
                  Ficha real de Google Maps del negocio.
                </p>
              </div>

              <div className="modal-footer-buttons" style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  disabled={resetLoading}
                  onClick={handleResetPassword}
                  className="btn btn-secondary"
                  style={{ flex: 1, borderColor: "rgba(239, 68, 68, 0.3)", color: "#f87171", background: "rgba(239, 68, 68, 0.05)" }}
                >
                  {resetLoading ? <div className="spinner spinner-white"></div> : "Restablecer Clave 🔑"}
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  {editLoading ? <div className="spinner spinner-white"></div> : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Estilos CSS Premium integrados */}
      <style jsx>{`
        .superadmin-layout {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
          color: #f1f5f9;
          font-family: inherit;
        }

        .superadmin-navbar {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding: 1rem 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .navbar-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .navbar-logo {
          font-size: 2rem;
        }

        .navbar-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: white;
          margin: 0;
        }

        .navbar-subtitle {
          font-size: 0.75rem;
          color: #94a3b8;
          margin: 0;
        }

        .btn-logout {
          background: transparent;
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .btn-logout:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: #ef4444;
        }

        .superadmin-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2.5rem 1.5rem;
        }

        .content-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 2rem;
        }

        .section-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: white;
          margin-bottom: 0.25rem;
        }

        .section-subtitle {
          font-size: 0.875rem;
          color: #94a3b8;
        }

        .btn-provision {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          border: none;
          color: white;
          padding: 0.75rem 1.25rem;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
          transition: all 0.2s ease;
        }

        .btn-provision:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
        }

        /* KPIs */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2.5rem;
        }

        .kpi-card {
          background: rgba(30, 41, 59, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(8px);
          border-radius: 16px;
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }

        .kpi-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
        }

        .bg-purple { background: rgba(99, 102, 241, 0.15); color: #818cf8; }
        .bg-green { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
        .bg-red { background: rgba(239, 68, 68, 0.15); color: #f87171; }

        .kpi-label {
          font-size: 0.875rem;
          color: #94a3b8;
          margin-bottom: 0.25rem;
        }

        .kpi-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: white;
          margin: 0;
        }

        /* Tabla */
        .table-wrapper {
          background: rgba(30, 41, 59, 0.45);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          overflow: hidden;
        }

        .tenants-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .tenants-table th {
          background: rgba(15, 23, 42, 0.35);
          padding: 1rem 1.5rem;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #94a3b8;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .tenants-table td {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          font-size: 0.875rem;
        }

        .table-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .font-bold {
          font-weight: 600;
          color: white;
        }

        .text-muted {
          color: #64748b;
        }

        /* Badges */
        .badge {
          padding: 0.25rem 0.625rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
          display: inline-block;
        }

        .badge-code {
          background: rgba(99, 102, 241, 0.1);
          color: #818cf8;
          border: 1px solid rgba(99, 102, 241, 0.2);
          font-family: monospace;
        }

        .badge-active {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
        }

        .badge-suspended {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }

        /* Switch toggle button */
        .status-container {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 22px;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #475569;
          transition: 0.3s;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
        }

        input:checked + .slider {
          background-color: #22c55e;
        }

        input:checked + .slider:before {
          transform: translateX(22px);
        }

        .slider.round {
          border-radius: 34px;
        }

        .slider.round:before {
          border-radius: 50%;
        }

        .btn-view {
          display: inline-flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #f1f5f9;
          padding: 0.375rem 0.75rem;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .btn-view:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: #f1f5f9;
        }

        /* Paginación */
        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 1.25rem;
          background: rgba(15, 23, 42, 0.15);
        }

        .pagination-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.875rem;
        }

        .pagination-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
        }

        .pagination-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .pagination-info {
          font-size: 0.875rem;
          color: #94a3b8;
        }

        /* Modal Overlay */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 1.25rem;
        }

        .modal-container {
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.08);
          width: 100%;
          max-width: 480px;
          border-radius: 20px;
          padding: 2rem;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.75rem;
        }

        .modal-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: white;
        }

        .btn-close {
          background: transparent;
          border: none;
          font-size: 1.125rem;
          cursor: pointer;
        }

        .modal-input {
          width: 100%;
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          padding: 0.75rem 1rem;
          color: white;
          font-size: 0.9375rem;
          outline: none;
          transition: border-color 0.2s ease;
        }

        .modal-input:focus {
          border-color: #6366f1;
        }

        .input-tip {
          font-size: 0.75rem;
          color: #64748b;
          margin-top: 0.375rem;
        }

        .modal-error-card {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 10px;
          padding: 0.75rem 1rem;
          margin-bottom: 1.25rem;
          display: flex;
          gap: 0.75rem;
          color: #ef4444;
          font-size: 0.875rem;
        }

        /* Success Panel */
        .success-panel {
          text-align: center;
        }

        .success-icon {
          font-size: 3rem;
          display: block;
          margin-bottom: 0.75rem;
        }

        .success-title {
          font-size: 1.25rem;
          color: #4ade80;
          margin-bottom: 0.375rem;
        }

        .success-subtitle {
          font-size: 0.875rem;
          color: #94a3b8;
          margin-bottom: 1.5rem;
        }

        .credentials-card {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1.75rem;
          text-align: left;
        }

        .cred-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.625rem 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .cred-row:last-child {
          border-bottom: none;
        }

        .cred-label {
          font-size: 0.875rem;
          color: #94a3b8;
        }

        .copy-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .password-text {
          font-family: monospace;
          background: rgba(255, 255, 255, 0.05);
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .btn-copy {
          background: #475569;
          border: none;
          color: white;
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
          font-size: 0.75rem;
          cursor: pointer;
          font-weight: 500;
        }

        .btn-copy:hover {
          background: #64748b;
        }

        /* Animaciones */
        .fade-in {
          animation: fadeIn 0.25s ease-out forwards;
        }

        .scale-up {
          animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .table-loader, .table-empty {
          padding: 4rem 2rem;
          text-align: center;
          color: #94a3b8;
        }

        .table-loader .spinner {
          margin: 0 auto 1rem;
        }
      `}</style>
    </div>
  );
}
