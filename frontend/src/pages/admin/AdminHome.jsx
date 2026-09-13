import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Users, GraduationCap, ClipboardList, Star, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, PieChart, Pie, Cell, CartesianGrid } from "recharts";

const chartColors = ["#0055FF", "#6366F1", "#22C55E", "#F59E0B", "#EF4444"];

const Metric = ({ icon: Icon, label, value, sub }) => (
    <div className="glass rounded-2xl p-5 card-lift">
        <div className="flex items-start justify-between">
            <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</div>
                <div className="mt-2 font-display text-3xl font-medium tracking-tight text-slate-900">{value}</div>
                {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
            </div>
            <div className="h-9 w-9 rounded-xl bg-[#0055FF]/10 text-[#0055FF] grid place-items-center">
                <Icon size={16} strokeWidth={1.6} />
            </div>
        </div>
    </div>
);

const AdminHome = () => {
    const [s, setS] = useState(null);

    useEffect(() => {
        api.get("/analytics/summary").then((r) => setS(r.data));
    }, []);

    if (!s) return <div className="text-slate-500">Loading…</div>;

    const empty = s.totals.responses === 0;
    const EmptyChart = ({ label }) => (
        <div className="h-64 grid place-items-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-2xl">
            No {label} yet
        </div>
    );

    return (
        <div data-testid="admin-home">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Overview</div>
            <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">Admin dashboard</h1>
            <p className="text-slate-600 mt-1">A calm view of how the semester is doing.</p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                <Metric icon={Star} label="Avg rating" value={s.totals.avg_rating || "—"} sub="all cycles" />
                <Metric icon={ClipboardList} label="Responses" value={s.totals.responses} sub={`${s.totals.completion}% complete`} />
                <Metric icon={GraduationCap} label="Students" value={s.totals.students} sub={`${s.totals.pending} pending`} />
                <Metric icon={Users} label="Faculty" value={s.totals.faculty} sub={`${s.totals.cycles_active} active cycles`} />
            </div>

            <div className="grid lg:grid-cols-3 gap-5 mt-6">
                <div className="glass rounded-2xl p-6 lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Faculty ratings</div>
                            <div className="font-display text-lg font-semibold text-slate-900">Top faculty by average</div>
                        </div>
                        <TrendingUp size={16} className="text-slate-400" />
                    </div>
                    <div style={{ width: "100%", height: 280, minHeight: 280 }}>
                        {empty || !s.faculty_ratings.length ? (
                            <EmptyChart label="faculty ratings" />
                        ) : (
                            <ResponsiveContainer>
                                <BarChart data={s.faculty_ratings.slice(0, 8)} margin={{ left: -10, right: 10, top: 10, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                    <XAxis dataKey="faculty" tick={{ fontSize: 11, fill: "#64748b" }} interval={0} angle={-15} textAnchor="end" height={60} />
                                    <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: "#64748b" }} />
                                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }} />
                                    <Bar dataKey="avg" fill="#0055FF" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <div className="glass rounded-2xl p-6">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">Department mix</div>
                    <div className="font-display text-lg font-semibold text-slate-900 mb-4">Response share</div>
                    <div style={{ width: "100%", height: 240, minHeight: 240 }}>
                        {empty || !s.dept_ratings.length ? (
                            <EmptyChart label="department data" />
                        ) : (
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie data={s.dept_ratings} dataKey="count" nameKey="department" innerRadius={50} outerRadius={80} paddingAngle={4} label={(e) => `${e.department}: ${e.count}`}>
                                        {s.dept_ratings.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    {!empty && s.dept_ratings.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                            {s.dept_ratings.map((d, i) => (
                                <div key={d.department} className="flex items-center justify-between text-xs">
                                    <span className="inline-flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: chartColors[i % chartColors.length] }} />
                                        {d.department}
                                    </span>
                                    <span className="text-slate-500">{d.count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="glass rounded-2xl p-6 mt-6">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Trend</div>
                <div className="font-display text-lg font-semibold text-slate-900 mb-3">Average rating over time</div>
                <div style={{ width: "100%", height: 260, minHeight: 260 }}>
                    {empty || !s.trend.length ? (
                        <EmptyChart label="trend data" />
                    ) : (
                        <ResponsiveContainer>
                            <LineChart data={s.trend} margin={{ left: -10, right: 10, top: 10 }}>
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
        </div>
    );
};

export default AdminHome;
