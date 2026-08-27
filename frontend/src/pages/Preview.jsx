import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { GraduationCap, User, Shield, ArrowRight, FlaskConical } from "lucide-react";
import { toast } from "sonner";

// NOTE: This page is intentionally NOT linked from any public interface.
// It exists only for internal preview/demo purposes at the URL /preview.
const Preview = () => {
    const nav = useNavigate();
    const { setUser, refresh } = useAuth();
    const [busy, setBusy] = useState("");

    const enter = async (role) => {
        setBusy(role);
        try {
            const res = await api.post("/auth/dev-preview", { role });
            setUser(res.data.user);
            await refresh();
            const dest = role === "admin" ? "/admin" : role === "faculty" ? "/faculty" : "/dashboard";
            nav(dest, { replace: true });
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Preview session failed");
        } finally {
            setBusy("");
        }
    };

    const options = [
        { role: "student", icon: GraduationCap, title: "Preview as Student", desc: "See the student dashboard, cycles and the multi-faculty feedback wizard." },
        { role: "faculty", icon: User, title: "Preview as Faculty", desc: "Open the faculty portal with anonymous insights and comments." },
        { role: "admin", icon: Shield, title: "Preview as Admin", desc: "Enter the admin console: structure, templates, cycles and analytics." },
    ];

    return (
        <div className="relative min-h-screen bg-[#0A1128] text-white overflow-hidden noise">
            <div className="glow bg-[#0055FF]" style={{ width: 500, height: 500, left: -120, top: -120, opacity: 0.3 }} />
            <div className="glow" style={{ width: 500, height: 500, right: -120, bottom: -160, background: "#1e40af", opacity: 0.35 }} />
            <div className="relative max-w-5xl mx-auto px-6 py-16 min-h-screen">
                <a href="/" className="flex items-center gap-2.5 mb-10 w-fit">
                    <span className="h-9 w-9 rounded-xl bg-white text-[#0A1128] grid place-items-center">
                        <GraduationCap size={18} strokeWidth={1.6} />
                    </span>
                    <div className="leading-tight">
                        <div className="font-display text-[15px] font-semibold">KLECBA</div>
                        <div className="text-[11px] text-white/60 -mt-0.5">Preview Console</div>
                    </div>
                </a>

                <div className="inline-flex w-fit items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/60 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 mb-4">
                    <FlaskConical size={12} /> Internal preview · not linked from the public login
                </div>
                <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight leading-[1.05]">
                    Choose a preview role.
                </h1>
                <p className="mt-3 text-white/60 max-w-xl">
                    Instant, password-less access to each interface for demo purposes only.
                    Real students and faculty still authenticate through their college Google account.
                </p>

                <div className="grid md:grid-cols-3 gap-4 mt-10">
                    {options.map((o, i) => (
                        <motion.button
                            key={o.role}
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.4 }}
                            onClick={() => enter(o.role)}
                            disabled={!!busy}
                            className="glass-dark rounded-2xl p-6 text-left card-lift disabled:opacity-60 disabled:cursor-not-allowed"
                            data-testid={`preview-as-${o.role}`}
                        >
                            <div className="h-11 w-11 rounded-xl bg-white/10 text-white grid place-items-center mb-4">
                                <o.icon size={18} strokeWidth={1.6} />
                            </div>
                            <div className="font-display text-lg font-semibold">{o.title}</div>
                            <div className="text-sm text-white/60 mt-1">{o.desc}</div>
                            <div className="mt-5 inline-flex items-center gap-1.5 text-sm text-[#8AB4FF] font-medium">
                                {busy === o.role ? "Opening…" : "Enter"}
                                <ArrowRight size={14} strokeWidth={1.8} />
                            </div>
                        </motion.button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Preview;
