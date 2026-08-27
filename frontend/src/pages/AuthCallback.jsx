import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const AuthCallback = () => {
    const nav = useNavigate();
    const { setUser, setProfile } = useAuth();
    const hasProcessed = useRef(false);

    useEffect(() => {
        if (hasProcessed.current) return;
        hasProcessed.current = true;
        const hash = window.location.hash || "";
        const m = hash.match(/session_id=([^&]+)/);
        if (!m) { nav("/login", { replace: true }); return; }
        const session_id = decodeURIComponent(m[1]);
        (async () => {
            try {
                const res = await api.post("/auth/session", { session_id });
                setUser(res.data.user);
                try {
                    const me = await api.get("/auth/me");
                    setProfile(me.data.profile || null);
                } catch { /* noop */ }
                window.history.replaceState(null, "", window.location.pathname);
                const role = res.data.user.role;
                nav(role === "admin" ? "/admin" : "/dashboard", { replace: true, state: { user: res.data.user } });
            } catch (err) {
                const detail = err?.response?.data?.detail || "";
                const kind = detail.toLowerCase().includes("domain") ? "domain" : "1";
                nav(`/login?error=${kind}`, { replace: true });
            }
        })();
    }, [nav, setUser, setProfile]);

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
