import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { isAuthConfigured } from "./auth/msalConfig";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";

// When Azure AD is not configured, skip auth entirely
function PrivateRoute({ children }) {
  if (!isAuthConfigured) return children;

  // With MSAL the MsalAuthenticationTemplate handles redirect in main.jsx
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
