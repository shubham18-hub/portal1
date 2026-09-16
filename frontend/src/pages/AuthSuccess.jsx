import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const AuthSuccess = () => {
    const nav = useNavigate();
    const { setUser, setProfile } = useAuth();
    const hasProcessed = useRef(false);

    useEffect(() => {
        if (hasProcessed.current) return;
        hasProcessed.current = true;

        (async () => {
            try {
                // Get current user from backend (session cookie was set during OAuth callback)
                const me = await api.get("/auth/me");
                setUser(me.data.user);
                if (me.data.profile) {
                    setProfile(me.data.profile);
                }
                
                // Redirect based on role
                const role = me.data.user.role;
                const dest = role === "admin" ? "/admin" : role === "faculty" ? "/faculty" : "/dashboard";
                nav(dest, { replace: true, state: { user: me.data.user } });
            } catch (err) {
                console.error("Failed to get user after OAuth:", err);
                nav("/login?error=session", { replace: true });
            }
        })();
    }, [nav, setUser, setProfile]);

    return (
        <div className="min-h-screen grid place-items-center bg-[#0A1128] text-white">
            <div className="flex items-center gap-3">
                <Loader2 className="animate-spin" size={20} strokeWidth={1.6} />
                <span className="text-sm text-white/80">Completing sign-in…</span>
            </div>
        </div>
    );
};

export default AuthSuccess;
