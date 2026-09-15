import React, { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const AuthCallback = () => {
    const nav = useNavigate();
    const [params] = useSearchParams();
    const { setUser, setProfile } = useAuth();
    const hasProcessed = useRef(false);

    useEffect(() => {
        if (hasProcessed.current) return;
        hasProcessed.current = true;

        const code = params.get("code");
        const state = params.get("state");
        const error = params.get("error");

        console.log("AuthCallback: code=", code, "state=", state, "error=", error);
        console.log("Full URL:", window.location.href);

        // Handle OAuth errors
        if (error) {
            const errorDesc = params.get("error_description") || error;
            console.error("OAuth error:", errorDesc);
            nav(`/login?error=${encodeURIComponent(errorDesc)}`, { replace: true });
            return;
        }

        // Legacy Emergent auth flow (session_id in hash)
        const hash = window.location.hash || "";
        const legacyMatch = hash.match(/session_id=([^&]+)/);
        if (legacyMatch && !code) {
            console.log("Legacy Emergent flow detected");
            nav(`/login?error=deprecated`, { replace: true });
            return;
        }

        // New Google OAuth flow - redirect to backend callback
        if (code && state) {
            console.log("Google OAuth flow: redirecting to backend callback");
            const backendUrl = process.env.REACT_APP_BACKEND_URL;
            const callbackUrl = `${backendUrl}/api/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
            console.log("Callback URL:", callbackUrl);
            window.location.href = callbackUrl;
            return;
        }

        console.warn("No valid OAuth parameters found, redirecting to login");
        nav("/login", { replace: true });
    }, [nav, params, setUser, setProfile]);

    return (
        <div className="min-h-screen grid place-items-center bg-[#0A1128] text-white">
            <div className="flex items-center gap-3">
                <Loader2 className="animate-spin" size={20} strokeWidth={1.6} />
                <span className="text-sm text-white/80">Signing you in securely…</span>
            </div>
        </div>
    );
};

export default AuthCallback;
