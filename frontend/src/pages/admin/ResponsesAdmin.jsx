import React, { useEffect, useMemo, useState } from "react";
import api, { API_BASE } from "@/lib/api";
import { Download, Search } from "lucide-react";

const ResponsesAdmin = () => {
    const [responses, setResponses] = useState([]);
    const [cycles, setCycles] = useState([]);
    const [depts, setDepts] = useState([]);
    const [filters, setFilters] = useState({ cycle_id: "", department_id: "" });

    const load = async () => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
        const [r, c, d] = await Promise.all([
            api.get(`/responses?${params.toString()}`),
            api.get("/cycles"),
            api.get("/departments"),
        ]);
        setResponses(r.data); setCycles(c.data); setDepts(d.data);
    };
    useEffect(() => { load(); }, [filters]);

    const download = (fmt) => {
        const params = new URLSearchParams();
        if (filters.cycle_id) params.set("cycle_id", filters.cycle_id);
        params.set("fmt", fmt);
        window.open(`${API_BASE}/export?${params.toString()}`, "_blank");
    };

    return (
        <div>
            <div className="flex items-end justify-between gap-4">
                <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Data</div>
                    <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">Responses</h1>
                    <p className="text-slate-600 mt-1">Filter, review, and export submitted feedback.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => download("csv")} className="btn-ghost text-sm inline-flex items-center gap-1.5" data-testid="resp-csv-btn"><Download size={14} /> CSV</button>
                    <button onClick={() => download("xlsx")} className="btn-ghost text-sm inline-flex items-center gap-1.5" data-testid="resp-xlsx-btn"><Download size={14} /> Excel</button>
                </div>
            </div>

            <div className="glass rounded-2xl p-4 mt-6 flex flex-wrap gap-3">
                <select value={filters.cycle_id} onChange={(e) => setFilters({ ...filters, cycle_id: e.target.value })} className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" data-testid="filter-cycle">
                    <option value="">All cycles</option>
                    {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={filters.department_id} onChange={(e) => setFilters({ ...filters, department_id: e.target.value })} className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" data-testid="filter-dept">
                    <option value="">All departments</option>
                    {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <div className="ml-auto text-sm text-slate-500 self-center">
                    <span data-testid="resp-count">{responses.length}</span> response(s)
                </div>
            </div>

            <div className="glass rounded-2xl p-4 mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-widest text-slate-500 border-b border-slate-200">
                            <th className="py-2 pr-3">Submitted</th>
                            <th className="pr-3">Cycle</th>
                            <th className="pr-3">Faculty covered</th>
                            <th className="pr-3">Avg rating</th>
                        </tr>
                    </thead>
                    <tbody>
                        {responses.map((r) => (
                            <tr key={r.id} className="border-b border-slate-100" data-testid={`resp-row-${r.id}`}>
                                <td className="py-2 pr-3 text-slate-600">{new Date(r.submitted_at).toLocaleString()}</td>
                                <td className="pr-3 text-slate-800 font-medium">{cycles.find((c) => c.id === r.cycle_id)?.name || r.cycle_id}</td>
                                <td className="pr-3 text-slate-600">{(r.faculty_snapshot || []).length}</td>
                                <td className="pr-3"><span className="font-semibold text-[#0055FF]">{r.avg}/5</span></td>
                            </tr>
                        ))}
                        {responses.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-slate-400">No responses yet</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ResponsesAdmin;
