//const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/v1";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://fidbak-backendfidbak.rucbu9.easypanel.host/v1";


export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || API_BASE.replace(/\/v1$/, "");

// Helper para cabeceras y token JWT
const getHeaders = (isMultipart = false) => {
  const headers = {};
  if (!isMultipart) {
    headers["Content-Type"] = "application/json";
  }

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("admin_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return headers;
};

// Manejo unificado de respuestas
const handleResponse = async (response) => {
  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Si da 401 en panel administrativo, desautenticar
    if (response.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("admin_token");
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    throw new Error(data.detail || "Error en la comunicación con el servidor");
  }
  return data;
};

export const api = {
  // --- Endpoints Públicos (Comensal / NFC Resolver) ---
  resolver: {
    getBranding: async (shortCode) => {
      const res = await fetch(`${API_BASE}/resolver/${shortCode}`, {
        method: "GET",
        headers: getHeaders(),
      });
      return handleResponse(res);
    },

    submitFeedback: async (shortCode, rating, comment = null) => {
      const res = await fetch(`${API_BASE}/resolver/${shortCode}/feedback`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ rating, comment }),
      });
      return handleResponse(res);
    },

    recordMetric: async (shortCode, eventType, rating = null) => {
      const res = await fetch(`${API_BASE}/resolver/${shortCode}/metric`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ event_type: eventType, rating }),
      });
      return handleResponse(res);
    },
  },

  // --- Endpoints de Autenticación ---
  auth: {
    login: async (email, password) => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await handleResponse(res);
      if (data && data.access_token) {
        localStorage.setItem("admin_token", data.access_token);
      }
      return data;
    },

    logout: () => {
      localStorage.removeItem("admin_token");
      window.location.href = "/login";
    },

    isAuthenticated: () => {
      if (typeof window === "undefined") return false;
      return !!localStorage.getItem("admin_token");
    },

    changePassword: async (currentPassword, newPassword) => {
      const res = await fetch(`${API_BASE}/auth/password`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      return handleResponse(res);
    }
  },

  // --- Endpoints Administrativos ---
  admin: {
    getLocation: async () => {
      const res = await fetch(`${API_BASE}/admin/location`, {
        method: "GET",
        headers: getHeaders(),
      });
      return handleResponse(res);
    },

    updateLocation: async (payload) => {
      const res = await fetch(`${API_BASE}/admin/location`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(res);
    },

    uploadLogo: async (file) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/admin/location/logo`, {
        method: "POST",
        headers: getHeaders(true),
        body: formData,
      });
      return handleResponse(res);
    },

    getFeedback: async (page = 1, limit = 10) => {
      const res = await fetch(`${API_BASE}/admin/feedback?page=${page}&limit=${limit}`, {
        method: "GET",
        headers: getHeaders(),
      });
      return handleResponse(res);
    },

    getAnalytics: async () => {
      const res = await fetch(`${API_BASE}/admin/analytics`, {
        method: "GET",
        headers: getHeaders(),
      });
      return handleResponse(res);
    }
  },

  // --- Endpoints de Súper Administrador ---
  superadmin: {
    getTenants: async (page = 1, limit = 10) => {
      const res = await fetch(`${API_BASE}/superadmin/tenants?page=${page}&limit=${limit}`, {
        method: "GET",
        headers: getHeaders(),
      });
      return handleResponse(res);
    },

    createTenant: async (payload) => {
      const res = await fetch(`${API_BASE}/superadmin/tenants`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(res);
    },

    updateTenantStatus: async (tenantId, isActive) => {
      const res = await fetch(`${API_BASE}/superadmin/tenants/${tenantId}/status`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ is_active: isActive }),
      });
      return handleResponse(res);
    },

    updateTenantLocation: async (tenantId, payload) => {
      const res = await fetch(`${API_BASE}/superadmin/tenants/${tenantId}/location`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(res);
    },

    resetTenantPassword: async (tenantId) => {
      const res = await fetch(`${API_BASE}/superadmin/tenants/${tenantId}/reset-password`, {
        method: "POST",
        headers: getHeaders(),
      });
      return handleResponse(res);
    }
  }
};

// Utilidad para decodificar JWT sin dependencias externas
export const decodeToken = (token) => {
  try {
    if (!token) return null;
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Error al decodificar token JWT:", e);
    return null;
  }
};
