import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle2, Clock, Calendar } from "lucide-react";

const StudentDashboard = () => {
    const { user, profile } = useAuth();
    const [cycles, setCycles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const r = await api.get("/my/cycles");
                setCycles(r.data);
            } finally { setLoading(false); }
        })();
    }, []);

    const hasProfile = !!profile;

    return (
        <Layout>
            <div className="max-w-5xl mx-auto px-6 pb-16" data-testid="student-dashboard">
                <div className="mb-8">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Welcome back</div>
                    <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">
                        Hello, {user?.name?.split(" ")[0] || "there"}.
                    </h1>
                    <p className="text-slate-600 mt-2 max-w-xl">
                        Your feedback helps us improve teaching and learning.
                    </p>
                </div>

                {!hasProfile ? (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-8 border border-amber-300/50" data-testid="no-profile-banner">
                        <div className="flex items-start gap-4">
                            <div className="h-11 w-11 rounded-xl bg-amber-500/15 text-amber-700 grid place-items-center shrink-0">
                                <AlertCircle size={18} strokeWidth={1.6} />
                            </div>
                            <div>
                                <div className="font-display text-lg font-semibold text-slate-900">Your academic profile has not been assigned yet.</div>
                                <p className="text-slate-600 mt-1">Please contact the college administration to have your Department, Year, Semester, and Division assigned. Once assigned, you'll see your feedback here.</p>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <>
                        <div className="glass rounded-2xl p-6 mb-8" data-testid="profile-card">
                            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Your academic profile</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <ProfileField label="Program" value={profile.program_id} entity="programs" />
                                <ProfileField label="Year" value={profile.year_level_id} entity="year_levels" />
                                <ProfileField label="Semester" value={profile.semester_id} entity="semesters" />
                                <ProfileField label="Division" value={profile.division_id} entity="divisions" />
                            </div>
                        </div>

                        <div className="mb-4 flex items-end justify-between">
                            <h2 className="font-display text-2xl font-medium tracking-tight text-slate-900">Available feedback</h2>
                        </div>

                        {loading ? (
                            <div className="glass rounded-2xl p-8 text-center text-slate-500 text-sm">Loading…</div>
                        ) : cycles.length === 0 ? (
                            <div className="glass rounded-2xl p-10 text-center" data-testid="no-cycles">
                                <div className="font-display text-lg font-semibold text-slate-900">Nothing to fill right now.</div>
                                <p className="text-slate-600 text-sm mt-1">You'll see feedback forms here when a cycle is active for your class.</p>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-4">
                                {cycles.map((c, i) => (
                                    <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                                        <Link to={c.submitted ? "#" : `/feedback/cycle/${c.id}`} onClick={(e) => c.submitted && e.preventDefault()} data-testid={`cycle-card-${c.id}`}
                                            className={`glass rounded-2xl p-6 card-lift flex flex-col gap-3 h-full ${c.submitted ? "opacity-90" : ""}`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="font-display text-lg font-semibold text-slate-900">{c.name}</div>
                                                    <div className="text-xs text-slate-500 inline-flex items-center gap-1 mt-1">
                                                        <Calendar size={12} /> {c.ends_at ? `Due ${new Date(c.ends_at).toLocaleDateString()}` : "Open"}
                                                    </div>
                                                </div>
                                                {c.submitted ? (
                                                    <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 inline-flex items-center gap-1">
                                                        <CheckCircle2 size={11} /> Submitted
                                                    </span>
                                                ) : c.has_draft ? (
                                                    <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-700 inline-flex items-center gap-1">
                                                        <Clock size={11} /> In progress
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider bg-[#0055FF]/10 text-[#0055FF]">
                                                        Open
                                                    </span>
                                                )}
                                            </div>
                                            {!c.submitted && (
                                                <div className="mt-auto inline-flex items-center gap-1.5 text-sm text-[#0055FF] font-medium">
                                                    {c.has_draft ? "Continue" : "Start feedback"}
                                                    <ArrowRight size={14} strokeWidth={1.8} />
                                                </div>
                                            )}
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </Layout>
    );
};

const ProfileField = ({ label, value, entity }) => {
    const [name, setName] = useState("—");
    useEffect(() => {
        if (!value) return;
        api.get(`/${entity}`).then((r) => setName(r.data.find((x) => x.id === value)?.name || "—")).catch(() => {});
    }, [value, entity]);
    return (
        <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</div>
            <div className="font-medium text-slate-900 mt-1">{name}</div>
        </div>
    );
};

export default StudentDashboard;
