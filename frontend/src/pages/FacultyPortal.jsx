import React, { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import api, { API_BASE } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Star, MessageCircle, TrendingUp, ShieldCheck, Download, TriangleAlert } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

const StatCard = ({ label, value, sub, icon: Icon }) => (
    <div className="glass rounded-2xl p-5 card-lift">
        <div className="flex items-start justify-between">
            <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</div>
                <div className="mt-2 font-display text-3xl font-medium tracking-tight text-slate-900">{value}</div>
                {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
            </div>
            {Icon && <div className="h-9 w-9 rounded-xl bg-[#0055FF]/10 text-[#0055FF] grid place-items-center"><Icon size={16} strokeWidth={1.6} /></div>}
        </div>
    </div>
);

const FacultyPortal = () => {
    const { user } = useAuth();
    const [ins, setIns] = useState(null);
    const [scope, setScope] = useState({ years: [], divisions: [] });
    const [year, setYear] = useState("");
    const [division, setDivision] = useState("");

    const params = useMemo(() => {
        const p = new URLSearchParams();
        if (year) p.set("year_level_id", year);
        if (division) p.set("division_id", division);
        return p.toString();
    }, [year, division]);

    useEffect(() => {
        api.get("/faculty/me/scope").then((r) => setScope(r.data)).catch(() => {});
    }, []);
    useEffect(() => {
        setIns(null);
        api.get(`/faculty/me/insights?${params}`).then((r) => setIns(r.data)).catch(() => setIns({ overall_avg: 0, response_count: 0, trend: [], question_ratings: [], subject_ratings: [], comments: [], improvement: null }));
    }, [params]);

    if (!ins) return <Layout><div className="max-w-5xl mx-auto px-6 py-20 text-slate-500">Loading…</div></Layout>;

    const empty = ins.response_count === 0;
    const download = (fmt) => window.open(`${API_BASE}/faculty/me/export?fmt=${fmt}&${params}`, "_blank");

    return (
        <Layout>
            <div className="max-w-6xl mx-auto px-6 pb-20" data-testid="faculty-portal">
                <div className="mb-8">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Faculty portal</div>
                    <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">
                        Hello, {user?.name?.split(" ")[0] || "professor"}.
                    </h1>
                    <p className="text-slate-600 mt-2 max-w-2xl inline-flex items-center gap-2">
                        <ShieldCheck size={14} strokeWidth={1.6} /> Anonymous insights based on student feedback.
                    </p>
                </div>

                <div className="glass rounded-2xl p-4 mb-6 flex flex-wrap gap-3 items-center" data-testid="faculty-filters">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 pr-1">Filter</div>
                    <select value={year} onChange={(e) => setYear(e.target.value)} className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" data-testid="faculty-year-filter">
                        <option value="">All years</option>
                        {scope.years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                    </select>
                    <select value={division} onChange={(e) => setDivision(e.target.value)} className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" data-testid="faculty-div-filter">
                        <option value="">All divisions</option>
                        {scope.divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <div className="ml-auto flex gap-2">
                        <button onClick={() => download("csv")} className="btn-ghost text-sm inline-flex items-center gap-1.5" data-testid="faculty-csv-btn"><Download size={14} /> CSV</button>
                        <button onClick={() => download("xlsx")} className="btn-ghost text-sm inline-flex items-center gap-1.5" data-testid="faculty-xlsx-btn"><Download size={14} /> Excel</button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Overall rating" value={ins.overall_avg || "—"} sub="out of 5" icon={Star} />
                    <StatCard label="Responses" value={ins.response_count} sub="anonymous" icon={MessageCircle} />
                    <StatCard label="Subjects" value={ins.subject_ratings.length} sub="rated" icon={TrendingUp} />
                    <StatCard label="Top question" value={ins.question_ratings[0]?.avg?.toFixed?.(1) || "—"} sub={ins.question_ratings[0]?.label?.slice(0, 22) || ""} icon={Star} />
                </div>

                {ins.improvement && ins.improvement.avg < 4.5 && (
                    <div className="glass rounded-2xl p-5 mt-5 border border-amber-300/50 flex items-start gap-3" data-testid="improvement-card">
                        <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-700 grid place-items-center shrink-0">
                            <TriangleAlert size={16} strokeWidth={1.6} />
                        </div>
                        <div>
                            <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Area to improve</div>
                            <div className="font-display text-lg text-slate-900 mt-0.5">"{ins.improvement.label}" averaged {ins.improvement.avg}/5</div>
                            <div className="text-sm text-slate-600 mt-0.5">Based on {ins.improvement.count} response(s) in the current selection.</div>
                        </div>
                    </div>
                )}
                {!ins.improvement && empty && (
                    <div className="glass rounded-2xl p-5 mt-5 text-sm text-slate-500" data-testid="not-enough-data">Not enough feedback data yet.</div>
                )}

                <div className="grid lg:grid-cols-3 gap-5 mt-6">
                    <div className="glass rounded-2xl p-6 lg:col-span-2">
                        <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">Trend</div>
                        <div className="font-display text-lg font-semibold mb-4">Rating over time</div>
                        <div style={{ width: "100%", height: 260, minHeight: 260 }}>
                            {empty || !ins.trend.length ? (
                                <div className="h-full grid place-items-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-2xl">No feedback yet</div>
                            ) : (
                                <ResponsiveContainer>
                                    <LineChart data={ins.trend} margin={{ left: -10, right: 10, top: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
                                        <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: "#64748b" }} />
                                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }} />
                                        <Line type="monotone" dataKey="avg" stroke="#0055FF" strokeWidth={2.5} dot={{ r: 4, fill: "#0055FF" }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                    <div className="glass rounded-2xl p-6">
                        <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">Subjects</div>
                        <div className="font-display text-lg font-semibold mb-2">By subject</div>
                        {ins.subject_ratings.length === 0 ? (
                            <div className="text-sm text-slate-400 py-6 text-center">No subject data yet</div>
                        ) : (
                            <div className="space-y-2 mt-2">
                                {ins.subject_ratings.map((s) => (
                                    <div key={s.subject} className="flex items-center justify-between text-sm py-2 border-b border-slate-100 last:border-0">
                                        <span className="text-slate-800">{s.subject}</span>
                                        <span className="font-semibold text-[#0055FF]">{s.avg}/5 <span className="text-xs text-slate-500 font-normal">({s.count})</span></span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass rounded-2xl p-6 mt-6">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">Question performance</div>
                    <div className="font-display text-lg font-semibold mb-4">How you scored on each question</div>
                    {ins.question_ratings.length === 0 ? (
                        <div className="text-sm text-slate-400 py-6 text-center">No question data yet</div>
                    ) : (
                        <div className="space-y-3">
                            {ins.question_ratings.map((q) => (
                                <div key={q.question_id} className="flex items-center gap-4 py-2 border-b border-slate-100 last:border-0">
                                    <div className="flex-1">
                                        <div className="text-sm text-slate-900 font-medium">{q.label}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">{q.count} response(s)</div>
                                    </div>
                                    <div className="w-40">
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-2 bg-[#0055FF]" style={{ width: `${(q.avg / 5) * 100}%` }} />
                                        </div>
                                    </div>
                                    <div className="w-14 text-right font-semibold text-[#0055FF]">{q.avg}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="glass rounded-2xl p-6 mt-6">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">Anonymous comments</div>
                    <div className="font-display text-lg font-semibold mb-3">Latest written feedback</div>
                    {ins.comments.length === 0 ? (
                        <div className="text-sm text-slate-400 py-6 text-center">No comments yet</div>
                    ) : (
                        <div className="space-y-3">
                            {ins.comments.map((c, i) => (
                                <div key={i} className="rounded-xl border border-slate-200 bg-white/60 p-4">
                                    <div className="text-sm text-slate-800">"{c.text}"</div>
                                    <div className="text-xs text-slate-500 mt-1">{c.subject} · {c.submitted_at?.slice(0, 10)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default FacultyPortal;
