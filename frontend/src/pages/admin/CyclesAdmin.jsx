import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X } from "lucide-react";

const emptyCycle = () => ({
    name: "", template_id: "", academic_year_id: "", department_id: "", program_id: "",
    year_level_id: "", semester_id: "", division_ids: [], starts_at: "", ends_at: "", status: "draft",
});

const CyclesAdmin = () => {
    const [cycles, setCycles] = useState([]);
    const [tmps, setTmps] = useState([]);
    const [depts, setDepts] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [years, setYears] = useState([]);
    const [sems, setSems] = useState([]);
    const [divs, setDivs] = useState([]);
    const [ayears, setAyears] = useState([]);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyCycle());

    const load = async () => {
        const [c, t, d, p, y, se, di, ay] = await Promise.all([
            api.get("/cycles"), api.get("/templates"), api.get("/departments"), api.get("/programs"),
            api.get("/year_levels"), api.get("/semesters"), api.get("/divisions"), api.get("/academic_years"),
        ]);
        setCycles(c.data); setTmps(t.data); setDepts(d.data); setPrograms(p.data);
        setYears(y.data); setSems(se.data); setDivs(di.data); setAyears(ay.data);
    };
    useEffect(() => { load(); }, []);

    const nameOf = (arr, id) => arr.find((x) => x.id === id)?.name || "—";
    const toLocal = (iso) => (iso ? iso.slice(0, 16) : "");

    const openNew = () => { setEditing({}); setForm(emptyCycle()); };
    const openEdit = (c) => { setEditing(c); setForm({ ...c, starts_at: toLocal(c.starts_at), ends_at: toLocal(c.ends_at) }); };

    const save = async () => {
        try {
            const body = {
                ...form,
                starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
                ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
            };
            if (form.id) await api.put(`/cycles/${form.id}`, body);
            else await api.post("/cycles", body);
            toast.success("Saved"); setEditing(null); load();
        } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    };
    const del = async (id) => {
        if (!confirm("Delete cycle?")) return;
        try { await api.delete(`/cycles/${id}`); toast.success("Deleted"); load(); } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    };

    const setStatus = async (c, status) => {
        try { await api.put(`/cycles/${c.id}`, { status }); toast.success(`Status: ${status}`); load(); } catch (e) { toast.error("Failed"); }
    };

    const toggleDiv = (id) => {
        const cur = new Set(form.division_ids || []);
        if (cur.has(id)) cur.delete(id); else cur.add(id);
        setForm({ ...form, division_ids: Array.from(cur) });
    };

    return (
        <div>
            <div className="flex items-end justify-between gap-4">
                <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Rollouts</div>
                    <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">Feedback cycles</h1>
                    <p className="text-slate-600 mt-1">Attach a template to an academic scope with dates.</p>
                </div>
                <button onClick={openNew} className="btn-primary text-sm inline-flex items-center gap-1.5" data-testid="new-cycle-btn">
                    <Plus size={14} /> New cycle
                </button>
            </div>

            <div className="glass rounded-2xl p-6 mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-widest text-slate-500 border-b border-slate-200">
                            <th className="py-2 pr-3">Name</th>
                            <th className="pr-3">Template</th>
                            <th className="pr-3">Program</th>
                            <th className="pr-3">Semester</th>
                            <th className="pr-3">Divisions</th>
                            <th className="pr-3">Status</th>
                            <th className="pr-3">Window</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cycles.map((c) => (
                            <tr key={c.id} className="border-b border-slate-100" data-testid={`cycle-row-${c.id}`}>
                                <td className="py-2 pr-3 font-medium text-slate-900">{c.name}</td>
                                <td className="pr-3 text-slate-600">{nameOf(tmps, c.template_id)}</td>
                                <td className="pr-3 text-slate-600">{nameOf(programs, c.program_id)}</td>
                                <td className="pr-3 text-slate-600">{nameOf(sems, c.semester_id)}</td>
                                <td className="pr-3 text-slate-600">{(c.division_ids || []).map((id) => nameOf(divs, id)).join(", ") || "All"}</td>
                                <td className="pr-3">
                                    <select value={c.status} onChange={(e) => setStatus(c, e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs" data-testid={`cycle-status-${c.id}`}>
                                        <option value="draft">Draft</option>
                                        <option value="scheduled">Scheduled</option>
                                        <option value="active">Active</option>
                                        <option value="closed">Closed</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </td>
                                <td className="pr-3 text-slate-500 text-xs">
                                    {c.starts_at ? new Date(c.starts_at).toLocaleDateString() : "—"} → {c.ends_at ? new Date(c.ends_at).toLocaleDateString() : "—"}
                                </td>
                                <td className="text-right">
                                    <button onClick={() => openEdit(c)} className="p-2 hover:bg-slate-100 rounded-lg" data-testid={`edit-cycle-${c.id}`}><Pencil size={14} strokeWidth={1.6} /></button>
                                    <button onClick={() => del(c.id)} className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg" data-testid={`del-cycle-${c.id}`}><Trash2 size={14} strokeWidth={1.6} /></button>
                                </td>
                            </tr>
                        ))}
                        {cycles.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-slate-400">No cycles yet</td></tr>}
                    </tbody>
                </table>
            </div>

            {editing !== null && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setEditing(null)}>
                    <div className="glass rounded-2xl p-6 w-full max-w-2xl mx-auto my-6" onClick={(e) => e.stopPropagation()} data-testid="cycle-editor">
                        <div className="flex items-center justify-between mb-4">
                            <div className="font-display text-lg font-semibold">{form.id ? "Edit cycle" : "New cycle"}</div>
                            <button onClick={() => setEditing(null)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <input placeholder="Cycle name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-[#0055FF] col-span-2" data-testid="cycle-name-input" />
                            <select value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-[#0055FF] col-span-2" data-testid="cycle-template-select">
                                <option value="">Template (published)</option>
                                {tmps.filter((t) => t.published_version_id).map((t) => <option key={t.id} value={t.id}>{t.name} — v{t.latest_version}</option>)}
                            </select>
                            {[
                                { k: "academic_year_id", ph: "Academic Year", opts: ayears },
                                { k: "department_id", ph: "Department", opts: depts },
                                { k: "program_id", ph: "Program", opts: programs },
                                { k: "year_level_id", ph: "Year", opts: years },
                                { k: "semester_id", ph: "Semester", opts: sems },
                            ].map((f) => (
                                <select key={f.k} value={form[f.k] || ""} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-[#0055FF]" data-testid={`cycle-${f.k}`}>
                                    <option value="">{f.ph}</option>
                                    {f.opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                                </select>
                            ))}
                            <div className="col-span-2">
                                <div className="text-xs text-slate-500 mb-1">Divisions (leave blank = all)</div>
                                <div className="flex flex-wrap gap-2">
                                    {divs.map((d) => {
                                        const on = (form.division_ids || []).includes(d.id);
                                        return (
                                            <button key={d.id} type="button" onClick={() => toggleDiv(d.id)} className={`px-3 py-1.5 rounded-full text-sm border ${on ? "bg-[#0055FF] border-[#0055FF] text-white" : "bg-white/70 border-slate-200 text-slate-700"}`} data-testid={`cycle-div-${d.id}`}>{d.name}</button>
                                        );
                                    })}
                                </div>
                            </div>
                            <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-[#0055FF]" data-testid="cycle-starts-input" />
                            <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-[#0055FF]" data-testid="cycle-ends-input" />
                            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-[#0055FF] col-span-2" data-testid="cycle-status-select">
                                <option value="draft">Draft</option>
                                <option value="scheduled">Scheduled</option>
                                <option value="active">Active</option>
                                <option value="closed">Closed</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setEditing(null)} className="btn-ghost text-sm">Cancel</button>
                            <button onClick={save} className="btn-primary text-sm" data-testid="save-cycle-btn">Save cycle</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CyclesAdmin;
