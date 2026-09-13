import React from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShieldCheck, GraduationCap } from "lucide-react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const Login = () => {
    const nav = useNavigate();
    const [params] = useSearchParams();

    const signIn = () => {
        const redirectUrl = window.location.origin + "/auth/callback";
        window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    };

    return (
        <div
            className="relative min-h-screen text-white overflow-hidden bg-cover bg-center"
            style={{
                backgroundImage:
                    "linear-gradient(160deg, rgba(30,20,15,0.35) 0%, rgba(20,15,10,0.55) 100%), url('https://customer-assets-lqy194kg.emergentagent.net/job_feedback-hub-408/artifacts/yuc2o6x2_loginpage.jpeg')",
            }}
        >
            <div className="relative max-w-5xl mx-auto px-6 min-h-screen grid md:grid-cols-2 items-center gap-10">
                <div>
                    <a href="/" className="inline-flex items-center gap-2.5 mb-10 group">
                        <span className="h-9 w-9 rounded-xl bg-white text-[#0A1128] grid place-items-center">
                            <GraduationCap size={18} strokeWidth={1.6} />
                        </span>
                        <div className="leading-tight">
                            <div className="font-display text-[15px] font-semibold">KLECBA</div>
                            <div className="text-[11px] text-white/60 -mt-0.5">Feedback Portal</div>
                        </div>
                    </a>
                    <motion.h1
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                        className="font-display text-4xl sm:text-5xl font-medium tracking-tight leading-[1.05]"
                    >
                        Access your portal.
                    </motion.h1>
                    <p className="mt-5 text-white/70 max-w-md leading-relaxed">
                        Sign in with your official college Google Workspace
                        account to continue.
                    </p>
                    <div className="mt-8 flex items-center gap-2 text-xs text-white/60">
                        <ShieldCheck size={14} strokeWidth={1.6} />
                        Restricted to authorized college domains.
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}
                    className="glass-dark rounded-3xl p-8 md:p-10"
                >
                    <div className="text-xs font-bold uppercase tracking-[0.24em] text-white/60 mb-3">
                        KLECBA
                    </div>
                    <h2 className="font-display text-2xl md:text-3xl font-medium">
                        Feedback Portal
                    </h2>
                    <p className="text-white/60 text-sm mt-2">
                        Access your portal.
                    </p>
                    {params.get("error") && (
                        <div className="mt-4 text-sm text-rose-300" data-testid="login-error">
                            {params.get("error") === "domain"
                                ? "Please use your college Google Workspace account."
                                : "Sign-in failed. Please try again."}
                        </div>
                    )}
                    <button
                        onClick={signIn}
                        className="mt-8 w-full inline-flex items-center justify-center gap-3 rounded-full bg-white text-slate-900 py-3.5 font-medium hover:bg-white/90 transition-colors"
                        data-testid="google-signin-btn"
                    >
                        <svg width="18" height="18" viewBox="0 0 48 48">
                            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z" />
                            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.7 18.9 12.5 24 12.5c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z" />
                            <path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2.1 1.5-4.7 2.4-7.3 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39 16.2 43.5 24 43.5z" />
                            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.2-.1-2.4-.5-3.5z" />
                        </svg>
                        Continue with Google
                    </button>
                    <p className="text-[11px] text-white/40 text-center pt-6">
                        By continuing you agree to KLECBA's acceptable use policy.
                    </p>
                </motion.div>
            </div>
        </div>
    );
};

export default Login;
