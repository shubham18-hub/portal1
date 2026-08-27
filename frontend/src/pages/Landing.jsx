import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
    Sparkles,
    ShieldCheck,
    LineChart,
    ArrowRight,
    Star,
    Calendar,
    BookOpen,
    FlaskConical,
    GraduationCap,
    User,
    Shield,
} from "lucide-react";

const Feature = ({ icon: Icon, title, desc }) => (
    <div className="glass rounded-2xl p-6 card-lift">
        <div className="h-11 w-11 rounded-xl bg-[#0055FF]/10 text-[#0055FF] grid place-items-center mb-4">
            <Icon size={20} strokeWidth={1.6} />
        </div>
        <div className="font-display font-semibold text-slate-900 text-lg mb-1.5">
            {title}
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
    </div>
);

const Landing = () => {
    const nav = useNavigate();
    const { setUser, refresh } = useAuth();
    const [busy, setBusy] = useState("");

    const enterPreview = async (role) => {
        setBusy(role);
        try {
            const res = await api.post("/auth/dev-preview", { role });
            setUser(res.data.user);
            await refresh();
            const dest = role === "admin" ? "/admin" : role === "faculty" ? "/faculty" : "/dashboard";
            nav(dest, { replace: true });
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Preview failed");
        } finally {
            setBusy("");
        }
    };

    return (
        <Layout bg="hero">
            <section className="relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 pt-8 pb-24">
                    <div className="flex flex-col items-start md:items-center md:text-center gap-6 max-w-3xl md:mx-auto">
                        <motion.span
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0055FF] bg-[#0055FF]/10 px-3 py-1.5 rounded-full"
                        >
                            KLECBA · Hubli
                        </motion.span>
                        <motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.55, delay: 0.05 }}
                            className="font-display text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-slate-900 leading-[1.05]"
                        >
                            Feedback, refined.
                            <br />
                            <span className="text-slate-500">
                                An institutional experience worth its name.
                            </span>
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.55, delay: 0.1 }}
                            className="text-slate-600 text-base md:text-lg leading-relaxed max-w-2xl"
                        >
                            A calm, premium portal where students, faculty and
                            administrators come together — thoughtful ratings,
                            elegant analytics, and events that stay in sync.
                        </motion.p>
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.55, delay: 0.15 }}
                            className="flex items-center gap-3 mt-2"
                        >
                            <button
                                onClick={() => nav("/login")}
                                className="btn-primary inline-flex items-center gap-2"
                                data-testid="hero-signin-btn"
                            >
                                Sign in with Google
                                <ArrowRight size={16} strokeWidth={1.8} />
                            </button>
                            <a
                                href="#features"
                                className="btn-ghost text-sm"
                                data-testid="hero-explore-btn"
                            >
                                Explore
                            </a>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.55, delay: 0.2 }}
                            className="mt-8 w-full md:max-w-2xl glass rounded-2xl p-5 md:p-6 border border-amber-300/40"
                            data-testid="dev-preview-panel"
                        >
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-700 mb-3">
                                <FlaskConical size={13} strokeWidth={1.8} />
                                Development preview · testing only
                            </div>
                            <p className="text-sm text-slate-600 mb-4">
                                Open any interface without Google or password. For your private preview environment only.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <button
                                    onClick={() => enterPreview("student")}
                                    disabled={!!busy}
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 text-white py-2.5 px-4 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-60"
                                    data-testid="preview-student-btn"
                                >
                                    <GraduationCap size={14} strokeWidth={1.8} />
                                    {busy === "student" ? "Opening…" : "Preview Student"}
                                </button>
                                <button
                                    onClick={() => enterPreview("faculty")}
                                    disabled={!!busy}
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 text-white py-2.5 px-4 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-60"
                                    data-testid="preview-faculty-btn"
                                >
                                    <User size={14} strokeWidth={1.8} />
                                    {busy === "faculty" ? "Opening…" : "Preview Faculty"}
                                </button>
                                <button
                                    onClick={() => enterPreview("admin")}
                                    disabled={!!busy}
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0055FF] text-white py-2.5 px-4 text-sm font-medium hover:bg-[#0044CC] transition-colors disabled:opacity-60"
                                    data-testid="preview-admin-btn"
                                >
                                    <Shield size={14} strokeWidth={1.8} />
                                    {busy === "admin" ? "Opening…" : "Preview Admin"}
                                </button>
                            </div>
                        </motion.div>

                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.2 }}
                        className="relative mt-16 max-w-5xl mx-auto"
                    >
                        <div className="glass rounded-3xl p-6 md:p-8 relative overflow-hidden">
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="col-span-1 space-y-4">
                                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                                        This semester
                                    </div>
                                    <div className="font-display text-4xl font-medium tracking-tight text-slate-900">
                                        4.62
                                        <span className="text-lg text-slate-400 font-normal">
                                            /5
                                        </span>
                                    </div>
                                    <div className="text-sm text-slate-600">
                                        Average teaching quality across all
                                        departments.
                                    </div>
                                    <div className="flex items-center gap-1 pt-1">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <Star
                                                key={s}
                                                size={16}
                                                strokeWidth={1.6}
                                                fill="#0055FF"
                                                className="text-[#0055FF]"
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                    {[
                                        {
                                            k: "1,240",
                                            v: "responses collected",
                                        },
                                        { k: "38", v: "active faculty" },
                                        { k: "12", v: "events this month" },
                                        { k: "94%", v: "participation rate" },
                                    ].map((s) => (
                                        <div
                                            key={s.v}
                                            className="rounded-2xl p-5 bg-white/70 border border-white/60"
                                        >
                                            <div className="font-display text-2xl font-medium text-slate-900">
                                                {s.k}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                {s.v}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div
                            className="glow bg-[#0055FF]"
                            style={{
                                width: 260,
                                height: 260,
                                left: -60,
                                top: -60,
                                opacity: 0.25,
                            }}
                        />
                        <div
                            className="glow"
                            style={{
                                width: 300,
                                height: 300,
                                right: -80,
                                bottom: -80,
                                background: "#a5b4fc",
                                opacity: 0.35,
                            }}
                        />
                    </motion.div>
                </div>
            </section>

            <section
                id="features"
                className="max-w-7xl mx-auto px-6 pt-6 pb-20"
            >
                <div className="max-w-2xl mb-10">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">
                        Everything you need
                    </div>
                    <h2 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">
                        Designed for institutions that
                        <br />
                        <span className="text-slate-500">
                            care about the details.
                        </span>
                    </h2>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                    <Feature
                        icon={Sparkles}
                        title="Four premium forms"
                        desc="Student, Certification, Faculty and Academic — every rating on a graceful 1–5 scale."
                    />
                    <Feature
                        icon={Calendar}
                        title="Live events"
                        desc="Seminars and workshops auto-unlock feedback the moment they finish."
                    />
                    <Feature
                        icon={LineChart}
                        title="Beautiful analytics"
                        desc="Ratings by teacher, department, semester and event — filterable and exportable."
                    />
                    <Feature
                        icon={BookOpen}
                        title="Teacher directory"
                        desc="A single source of truth for names, departments, and subjects taught."
                    />
                    <Feature
                        icon={ShieldCheck}
                        title="Secure by default"
                        desc="Google sign-in restricted to college accounts. Role-based access for every screen."
                    />
                    <Feature
                        icon={Star}
                        title="Buttery smooth"
                        desc="60fps micro-animations, glass surfaces, and a calm reading experience."
                    />
                </div>
            </section>

            <section className="max-w-7xl mx-auto px-6 pb-24">
                <div className="glass rounded-3xl p-10 md:p-14 text-center relative overflow-hidden">
                    <div
                        className="glow bg-[#0055FF]"
                        style={{
                            width: 400,
                            height: 400,
                            left: "50%",
                            top: "50%",
                            transform: "translate(-50%,-50%)",
                            opacity: 0.15,
                        }}
                    />
                    <h3 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">
                        Ready when you are.
                    </h3>
                    <p className="mt-3 text-slate-600 max-w-lg mx-auto">
                        Sign in with your college Google account and land in
                        the right dashboard, automatically.
                    </p>
                    <button
                        onClick={() => nav("/login")}
                        className="btn-primary mt-7 inline-flex items-center gap-2"
                        data-testid="cta-signin-btn"
                    >
                        Continue to sign in
                        <ArrowRight size={16} strokeWidth={1.8} />
                    </button>
                </div>
            </section>
        </Layout>
    );
};

export default Landing;
