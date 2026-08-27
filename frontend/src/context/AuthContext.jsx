import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const res = await api.get("/auth/me");
            setUser(res.data.user);
            setProfile(res.data.profile || null);
        } catch {
            setUser(null); setProfile(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (window.location.hash?.includes("session_id=")) {
            setLoading(false); return;
        }
        refresh();
    }, [refresh]);

    const logout = async () => {
        try { await api.post("/auth/logout"); } catch { /* noop */ }
        setUser(null); setProfile(null);
        window.location.href = "/";
    };

    return (
        <AuthContext.Provider value={{ user, profile, setUser, setProfile, loading, refresh, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
