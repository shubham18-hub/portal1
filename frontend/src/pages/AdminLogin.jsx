import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Lock, ArrowRight } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const AdminLogin = () => {
    const nav = useNavigate();
    const { setUser } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const res = await api.post("/auth/admin-login", { email, password });
            setUser(res.data.user);
            nav("/admin", { replace: true });
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Login failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="relative min-h-screen bg-[#0A1128] text-white overflow-hidden noise grid place-items-center px-6">
            <div className="glow bg-[#0055FF]" style={{ width: 500, height: 500, left: -120, top: -120, opacity: 0.3 }} />
            <div className="glow" style={{ width: 500, height: 500, right: -120, bottom: -160, background: "#1e40af", opacity: 0.35 }} />

            <motion.form
                onSubmit={submit}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                className="relative glass-dark rounded-3xl p-8 md:p-10 w-full max-w-md"
                data-testid="admin-login-form"
            >
                <a href="/" className="inline-flex items-center gap-2.5 mb-8">
                    <span className="h-9 w-9 rounded-xl bg-white text-[#0A1128] grid place-items-center">
                        <GraduationCap size={18} strokeWidth={1.6} />
                    </span>
                    <div className="leading-tight">
                        <div className="font-display text-[15px] font-semibold">KLECBA</div>
                        <div className="text-[11px] text-white/60 -mt-0.5">Admin Console</div>
                    </div>
                </a>
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/60 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 mb-4">
                    <Lock size={12} /> Restricted access
                </div>
                <h1 className="font-display text-3xl font-medium tracking-tight">
                    Administrator sign-in
                </h1>
                <p className="text-white/60 text-sm mt-2">
                    Use the credentials issued by the institution.
                </p>
                <div className="mt-8 space-y-3">
                    <input
                        type="email" required autoComplete="username"
                        placeholder="admin@klecba.edu.in" value={email} onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/40 focus:border-[#0055FF] outline-none"
                        data-testid="admin-email-input"
                    />
                    <input
                        type="password" required autoComplete="current-password"
                        placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/40 focus:border-[#0055FF] outline-none"
                        data-testid="admin-password-input"
                    />
                    <button
                        type="submit" disabled={busy}
                        className="w-full mt-2 rounded-full bg-[#0055FF] hover:bg-[#0044CC] py-3 text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
                        data-testid="admin-signin-btn"
                    >
                        {busy ? "Signing in…" : "Sign in"} <ArrowRight size={14} strokeWidth={1.8} />
                    </button>
                </div>
            </motion.form>
        </div>
    );
};

export default AdminLogin;
