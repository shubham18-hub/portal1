import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Filter } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const QuestionInsights = () => {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [cycles, setCycles] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [depts, setDepts] = useState([]);
    const [years, setYears] = useState([]);
    const [sems, setSems] = useState([]);
    const [divs, setDivs] = useState([]);
    const [subs, setSubs] = useState([]);
    const [ayears, setAyears] = useState([]);
    const [faculty, setFaculty] = useState([]);
    const [filters, setFilters] = useState({});

    useEffect(() => {
        (async () => {
            const [c, p, d, y, se, di, su, ay, f] = await Promise.all([
                api.get("/cycles"), api.get("/programs"), api.get("/departments"),
                api.get("/year_levels"), api.get("/semesters"), api.get("/divisions"),
                api.get("/subjects"), api.get("/academic_years"), api.get("/faculty"),
            ]);
            setCycles(c.data); setPrograms(p.data); setDepts(d.data); setYears(y.data);
            setSems(se.data); setDivs(di.data); setSubs(su.data); setAyears(ay.data); setFaculty(f.data);
        })();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
        api.get(`/analytics/question-insights?${params.toString()}`).then((r) => { setRows(r.data.rows); setTotal(r.data.count); });
    }, [filters]);

    const grouped = useMemo(() => {
        const g = new Map();
        rows.forEach((r) => {
            const key = `${r.faculty_id}|${r.subject_id}`;
            if (!g.has(key)) g.set(key, { faculty: r.faculty_name, subject: r.subject_name, questions: [] });
            g.get(key).questions.push(r);
        });
        return Array.from(g.values());
    }, [rows]);

    const Sel = ({ k, ph, opts, keyName = "name" }) => (
        <select value={filters[k] || ""} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })} className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" data-testid={`qi-${k}`}>
            <option value="">{ph}</option>
            {opts.map((o) => <option key={o.id || o.user_id} value={o.id || o.user_id}>{o[keyName]}</option>)}
        </select>
    );

    return (
        <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Analytics</div>
            <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">Question insights</h1>
            <p className="text-slate-600 mt-1">Per-faculty, per-question performance and rating distribution.</p>

            <div className="glass rounded-2xl p-4 mt-6 flex flex-wrap gap-2 items-center">
                <Filter size={14} className="text-slate-400 mr-1" />
                <Sel k="cycle_id" ph="All cycles" opts={cycles} />
                <Sel k="academic_year_id" ph="Academic Year" opts={ayears} />
                <Sel k="department_id" ph="Department" opts={depts} />
                <Sel k="program_id" ph="Program" opts={programs} />
                <Sel k="year_level_id" ph="Year" opts={years} />
                <Sel k="semester_id" ph="Semester" opts={sems} />
                <Sel k="division_id" ph="Division" opts={divs} />
                <Sel k="subject_id" ph="Subject" opts={subs} />
                <Sel k="faculty_id" ph="Faculty" opts={faculty} keyName="name" />
                <div className="ml-auto text-sm text-slate-500 self-center">
                    <span data-testid="qi-count">{total}</span> combination(s)
                </div>
            </div>

            {grouped.length === 0 ? (
                <div className="glass rounded-2xl p-10 text-center text-slate-400 text-sm mt-6" data-testid="qi-empty">No question-level data for the current filters yet.</div>
            ) : (
                <div className="space-y-4 mt-6">
                    {grouped.map((g, i) => (
                        <div key={i} className="glass rounded-2xl p-6" data-testid={`qi-group-${i}`}>
                            <div className="flex items-baseline justify-between mb-4">
                                <div>
                                    <div className="font-display text-lg font-semibold text-slate-900">{g.faculty}</div>
                                    <div className="text-xs text-slate-500">{g.subject}</div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {g.questions.map((q) => (
                                    <div key={q.question_id} className="flex flex-col md:flex-row md:items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                                        <div className="flex-1">
                                            <div className="text-sm text-slate-900 font-medium">{q.question_label}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">{q.count} response(s)</div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {[1, 2, 3, 4, 5].map((n) => {
                                                const cnt = q.distribution[String(n)] || 0;
                                                const pct = q.count ? Math.round((cnt / q.count) * 100) : 0;
                                                return (
                                                    <div key={n} className="w-9 text-center" title={`${n}★ · ${cnt} (${pct}%)`}>
                                                        <div className="h-16 bg-slate-100 rounded-md overflow-hidden flex items-end">
                                                            <div className="w-full bg-[#0055FF]" style={{ height: `${pct}%` }} />
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 mt-0.5">{n}★</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="w-14 text-right font-semibold text-[#0055FF]">{q.avg}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default QuestionInsights;
