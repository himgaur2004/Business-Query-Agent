import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000, // 60s — LLM inference can be slow on free tier
});

// Attach Bearer token from MSAL if available
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // MSAL token will be injected here via msalInstance.acquireTokenSilent
      const token = sessionStorage.getItem("bqa_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // No token — proceed unauthenticated (dev mode)
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Normalise errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      "An unexpected error occurred";
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
