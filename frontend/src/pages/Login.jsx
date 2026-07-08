import { useMsal } from "@azure/msal-react";
import { loginRequest, isAuthConfigured } from "../auth/msalConfig";

export default function Login() {
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginRedirect(loginRequest).catch(console.error);
  };

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="card text-center py-12 animate-slide-up">
          {/* Logo */}
          <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center text-4xl mx-auto mb-6">
            ⚡
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Business Query Agent</h1>
          <p className="text-sm text-slate-400 mb-8 max-w-xs mx-auto">
            Ask natural-language questions about your business data. Get instant SQL-backed answers.
          </p>

          {isAuthConfigured ? (
            <button
              id="login-btn"
              onClick={handleLogin}
              className="btn-primary w-full text-base py-3"
            >
              Sign in with Microsoft
            </button>
          ) : (
            <div className="space-y-3">
              <div className="px-4 py-3 bg-amber-900/30 border border-amber-700/50 rounded-xl text-xs text-amber-300">
                ⚠️ Azure AD not configured — running in dev mode
              </div>
              <a
                href="/"
                id="dev-continue-btn"
                className="btn-primary block w-full text-center text-base py-3"
              >
                Continue to Dashboard (Dev Mode)
              </a>
            </div>
          )}

          <p className="mt-6 text-xs text-slate-600">
            Powered by Groq LLM · Azure Static Web Apps
          </p>
        </div>
      </div>
    </div>
  );
}
