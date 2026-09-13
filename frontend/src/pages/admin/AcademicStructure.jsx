import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

const ENTITY_META = {
    departments: { label: "Departments", fields: [{ k: "name", ph: "Name" }, { k: "code", ph: "Code" }] },
    programs: { label: "Programs", fields: [{ k: "name", ph: "Name" }, { k: "code", ph: "Code" }, { k: "department_id", ph: "Department", type: "ref", ref: "departments" }] },
    academic_years: { label: "Academic Years", fields: [{ k: "name", ph: "e.g., 2025-2026" }] },
    year_levels: { label: "Year Levels", fields: [{ k: "name", ph: "e.g., 1st Year" }, { k: "order", ph: "Order (1,2,3)", type: "number" }] },
    semesters: { label: "Semesters", fields: [{ k: "name", ph: "Semester 1" }, { k: "order", ph: "Order", type: "number" }] },
    divisions: { label: "Divisions", fields: [{ k: "name", ph: "A" }] },
    subjects: { label: "Subjects", fields: [{ k: "name", ph: "Name" }, { k: "code", ph: "Code" }] },
};

const AcademicStructure = () => {
    const [active, setActive] = useState("departments");
    const [data, setData] = useState({});
    const [form, setForm] = useState({});

    const load = async () => {
        const entities = Object.keys(ENTITY_META);
        const results = await Promise.all(entities.map((e) => api.get(`/${e}`).then((r) => [e, r.data])));
        setData(Object.fromEntries(results));
    };
    useEffect(() => { load(); }, []);

    const meta = ENTITY_META[active];
    const rows = data[active] || [];

    const save = async () => {
        try {
            if (form.id) await api.put(`/${active}/${form.id}`, form);
            else await api.post(`/${active}`, form);
            toast.success("Saved"); setForm({}); load();
        } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    };
    const del = async (id) => {
        if (!confirm("Delete?")) return;
        await api.delete(`/${active}/${id}`); toast.success("Deleted"); load();
    };

    const refName = (ent, id) => (data[ent] || []).find((r) => r.id === id)?.name || "—";

    return (
        <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">
                Configuration
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">
                Academic structure
            </h1>
            <p className="text-slate-600 mt-1">Departments, programs, years, semesters, divisions and subjects.</p>

            <div className="mt-6 flex flex-wrap gap-2">
                {Object.entries(ENTITY_META).map(([k, v]) => (
                    <button
                        key={k}
                        onClick={() => { setActive(k); setForm({}); }}
                        className={`px-3.5 py-2 rounded-full text-sm border transition-colors ${active === k ? "bg-slate-900 text-white border-slate-900" : "bg-white/70 border-slate-200 text-slate-700 hover:bg-slate-900/5"}`}
                        data-testid={`ent-tab-${k}`}
                    >
                        {v.label}
                    </button>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-5 mt-6">
                <div className="glass rounded-2xl p-6 lg:col-span-2">
                    <div className="font-display text-lg font-semibold mb-3">{meta.label}</div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-widest text-slate-500 border-b border-slate-200">
                                    {meta.fields.map((f) => <th key={f.k} className="py-2 pr-3">{f.ph}</th>)}
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50" data-testid={`row-${active}-${r.id}`}>
                                        {meta.fields.map((f) => (
                                            <td key={f.k} className="py-2 pr-3 text-slate-800">
                                                {f.type === "ref" ? refName(f.ref, r[f.k]) : (r[f.k] ?? "—")}
                                            </td>
                                        ))}
                                        <td className="text-right">
                                            <button onClick={() => setForm(r)} className="p-2 hover:bg-slate-100 rounded-lg" data-testid={`edit-${r.id}`}><Pencil size={14} strokeWidth={1.6} /></button>
                                            <button onClick={() => del(r.id)} className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg" data-testid={`del-${r.id}`}><Trash2 size={14} strokeWidth={1.6} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr><td colSpan={meta.fields.length + 1} className="py-6 text-center text-slate-400">No records yet</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="glass rounded-2xl p-6">
                    <div className="font-display text-lg font-semibold mb-3">{form.id ? "Edit" : "Add new"}</div>
                    <div className="space-y-3">
                        {meta.fields.map((f) => (
                            f.type === "ref" ? (
                                <select
                                    key={f.k}
                                    value={form[f.k] || ""}
                                    onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 outline-none focus:border-[#0055FF] text-sm"
                                    data-testid={`in-${active}-${f.k}`}
                                >
                                    <option value="">{`Select ${f.ph}`}</option>
                                    {(data[f.ref] || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                                </select>
                            ) : (
                                <input
                                    key={f.k} type={f.type === "number" ? "number" : "text"}
                                    placeholder={f.ph}
                                    value={form[f.k] ?? ""}
                                    onChange={(e) => setForm({ ...form, [f.k]: f.type === "number" ? Number(e.target.value) : e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 outline-none focus:border-[#0055FF] text-sm"
                                    data-testid={`in-${active}-${f.k}`}
                                />
                            )
                        ))}
                        <div className="flex gap-2">
                            <button onClick={save} className="btn-primary text-sm inline-flex items-center gap-1.5" data-testid={`save-${active}`}>
                                <Plus size={14} strokeWidth={1.8} /> {form.id ? "Save" : "Add"}
                            </button>
                            {form.id && (
                                <button onClick={() => setForm({})} className="btn-ghost text-sm">Cancel</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AcademicStructure;
