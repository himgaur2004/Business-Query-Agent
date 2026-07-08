// MSAL configuration for Azure AD B2C
// In dev mode without credentials this module is a no-op stub
export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_AD_CLIENT_ID || "00000000-0000-0000-0000-000000000000",
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_AD_TENANT_ID || "common"}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ["openid", "profile", "email"],
};

// Whether auth is fully configured (non-placeholder credentials)
export const isAuthConfigured =
  import.meta.env.VITE_AZURE_AD_CLIENT_ID &&
  import.meta.env.VITE_AZURE_AD_CLIENT_ID !== "00000000-0000-0000-0000-000000000000";
