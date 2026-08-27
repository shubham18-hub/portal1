import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle2, Clock, Lock, BookOpen, Award, Users, Building2 } from "lucide-react";

const iconFor = (c) => ({ student: BookOpen, certification: Award, faculty: Users, academic: Building2 }[c] || BookOpen);

const badgeFor = (status) => {
    if (status === "ongoing") return { text: "Ongoing", cls: "bg-emerald-500/15 text-emerald-700 border border-emerald-200" };
    if (status === "completed") return { text: "Completed", cls: "bg-slate-900/5 text-slate-700 border border-slate-200" };
    return { text: "Upcoming", cls: "bg-amber-500/15 text-amber-700 border border-amber-200" };
};

const StudentDashboard = () => {
    const { user, profile } = useAuth();
    const [cats, setCats] = useState([]);
    const [mine, setMine] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refs, setRefs] = useState({});

    useEffect(() => {
        (async () => {
            try {
                const [c, m, p, y, se, di, ay] = await Promise.all([
                    api.get("/my/categories"),
                    api.get("/feedback/mine").catch(() => ({ data: [] })),
                    api.get("/programs"), api.get("/year_levels"),
                    api.get("/semesters"), api.get("/divisions"), api.get("/academic_years"),
                ]);
                setCats(c.data);
                setMine(m.data.slice(0, 6));
                setRefs({
                    programs: p.data, years: y.data, sems: se.data, divs: di.data, ayears: ay.data,
                });
            } finally { setLoading(false); }
        })();
    }, []);

    const nameOf = (arr, id) => arr?.find((x) => x.id === id)?.name || "—";
    const hasProfile = !!profile;

    return (
        <Layout>
            <div className="max-w-6xl mx-auto px-6 pb-16" data-testid="student-dashboard">
                <div className="mb-6">
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
                                <p className="text-slate-600 mt-1">Please contact the college administration.</p>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <>
                        <div className="glass rounded-2xl p-6 mb-8" data-testid="profile-card">
                            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Your academic profile</div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                                <Field label="Roll No." value={profile.student_id || "—"} testId="profile-rollno" />
                                <Field label="Program" value={nameOf(refs.programs, profile.program_id)} />
                                <Field label="Year" value={nameOf(refs.years, profile.year_level_id)} />
                                <Field label="Semester" value={nameOf(refs.sems, profile.semester_id)} />
                                <Field label="Division" value={nameOf(refs.divs, profile.division_id)} />
                            </div>
                        </div>

                        <div className="mb-4 flex items-end justify-between">
                            <h2 className="font-display text-2xl font-medium tracking-tight text-slate-900">Feedback</h2>
                            <div className="text-xs text-slate-500">Four categories · status updates in real-time</div>
                        </div>

                        {loading ? (
                            <div className="glass rounded-2xl p-8 text-center text-slate-500 text-sm">Loading…</div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-4">
                                {cats.map((c, i) => {
                                    const Icon = iconFor(c.category);
                                    const badge = badgeFor(c.status);
                                    const clickable = c.status === "ongoing" && !c.submitted && c.cycle;
                                    return (
                                        <motion.div key={c.category} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                                            <Link
                                                to={clickable ? `/feedback/cycle/${c.cycle.id}` : "#"}
                                                onClick={(e) => !clickable && e.preventDefault()}
                                                data-testid={`cat-card-${c.category}`}
                                                className={`glass rounded-2xl p-6 flex flex-col gap-3 h-full ${clickable ? "card-lift cursor-pointer" : "opacity-95 cursor-default"}`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-11 w-11 rounded-2xl bg-[#0055FF]/10 text-[#0055FF] grid place-items-center shrink-0">
                                                            <Icon size={18} strokeWidth={1.6} />
                                                        </div>
                                                        <div>
                                                            <div className="font-display text-lg font-semibold text-slate-900">{c.title}</div>
                                                            <div className="text-xs text-slate-500">{c.desc}</div>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${badge.cls}`} data-testid={`cat-status-${c.category}`}>{badge.text}</span>
                                                </div>
                                                <div className="mt-auto flex items-center justify-between text-sm">
                                                    {clickable ? (
                                                        <span className="inline-flex items-center gap-1.5 text-[#0055FF] font-medium">
                                                            {c.has_draft ? "Continue" : "Start feedback"} <ArrowRight size={14} strokeWidth={1.8} />
                                                        </span>
                                                    ) : c.submitted ? (
                                                        <span className="inline-flex items-center gap-1.5 text-emerald-700"><CheckCircle2 size={14} /> Submitted</span>
                                                    ) : c.status === "upcoming" ? (
                                                        <span className="inline-flex items-center gap-1.5 text-slate-500"><Lock size={14} /> Locked · awaiting admin</span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-slate-500"><Clock size={14} /> Closed</span>
                                                    )}
                                                    {c.cycle?.ends_at && <span className="text-xs text-slate-400">Closes {new Date(c.cycle.ends_at).toLocaleDateString()}</span>}
                                                </div>
                                            </Link>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="mt-12">
                            <h2 className="font-display text-2xl font-medium tracking-tight text-slate-900 mb-4">Your recent responses</h2>
                            {mine.length === 0 ? (
                                <div className="glass rounded-2xl p-8 text-center text-slate-500 text-sm">You haven't submitted any feedback yet.</div>
                            ) : (
                                <div className="glass rounded-2xl divide-y divide-slate-200/60 overflow-hidden">
                                    {mine.map((r) => (
                                        <div key={r.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                            <div>
                                                <div className="text-sm font-medium text-slate-900">Submitted</div>
                                                <div className="text-xs text-slate-500">{new Date(r.submitted_at).toLocaleString()}</div>
                                            </div>
                                            <div className="text-sm font-semibold text-[#0055FF]">{r.avg}/5</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
};

const Field = ({ label, value, testId }) => (
    <div data-testid={testId}>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</div>
        <div className="font-medium text-slate-900 mt-1">{value}</div>
    </div>
);

export default StudentDashboard;
