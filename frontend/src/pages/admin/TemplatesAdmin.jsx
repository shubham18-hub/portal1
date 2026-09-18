import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, CheckCircle2, GripVertical, X, Star } from "lucide-react";

const emptyQ = () => ({ id: crypto.randomUUID(), label: "", type: "rating", required: true });

const TemplatesAdmin = () => {
    const [tmps, setTmps] = useState([]);
    const [editing, setEditing] = useState(null);
    const [preview, setPreview] = useState(null);

    const load = async () => {
        const r = await api.get("/templates");
        setTmps(r.data);
    };
    useEffect(() => { load(); }, []);

    const create = async () => {
        const r = await api.post("/templates", { name: "New Template", category: "student" });
        setEditing(r.data); load();
    };

    const saveTpl = async (t) => {
        try {
            const r = await api.put(`/templates/${t.id}`, t);
            setEditing(r.data);
            toast.success("Saved"); load();
        } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    };

    const publish = async (t) => {
        try {
            await api.post(`/templates/${t.id}/publish`);
            toast.success("Published");
            load();
        } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    };

    const del = async (t) => {
        if (!confirm("Delete template?")) return;
        try { await api.delete(`/templates/${t.id}`); toast.success("Deleted"); load(); } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    };

    return (
        <div>
            <div className="flex items-end justify-between gap-4">
                <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Forms</div>
                    <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">Feedback templates</h1>
                    <p className="text-slate-600 mt-1">Build questions, publish an immutable version, then attach to cycles.</p>
                </div>
                <button onClick={create} className="btn-primary text-sm inline-flex items-center gap-1.5" data-testid="new-template-btn">
                    <Plus size={14} /> New template
                </button>
            </div>

            <div className="glass rounded-2xl p-6 mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-widest text-slate-500 border-b border-slate-200">
                            <th className="py-2 pr-3">Name</th>
                            <th className="pr-3">Category</th>
                            <th className="pr-3">Questions</th>
                            <th className="pr-3">Published Version</th>
                            <th className="pr-3">Iterates Faculty</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tmps.map((t) => (
                            <tr key={t.id} className="border-b border-slate-100" data-testid={`tpl-row-${t.id}`}>
                                <td className="py-2 pr-3 font-medium text-slate-900">{t.name}</td>
                                <td className="pr-3 text-slate-600 capitalize">{t.category}</td>
                                <td className="pr-3 text-slate-600">{(t.questions || []).length}</td>
                                <td className="pr-3 text-slate-600">{t.latest_version ? `v${t.latest_version}` : "—"}</td>
                                <td className="pr-3 text-slate-600">{t.iterates_faculty ? "Yes" : "No"}</td>
                                <td className="text-right">
                                    <button onClick={() => setPreview(t)} className="p-2 hover:bg-slate-100 rounded-lg" data-testid={`preview-tpl-${t.id}`}><Eye size={14} strokeWidth={1.6} /></button>
                                    <button onClick={() => setEditing(t)} className="p-2 hover:bg-slate-100 rounded-lg" data-testid={`edit-tpl-${t.id}`}><Pencil size={14} strokeWidth={1.6} /></button>
                                    <button onClick={() => del(t)} className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg" data-testid={`del-tpl-${t.id}`}><Trash2 size={14} strokeWidth={1.6} /></button>
                                </td>
                            </tr>
                        ))}
                        {tmps.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-400">No templates yet</td></tr>}
                    </tbody>
                </table>
            </div>

            {editing && (
                <TemplateEditor t={editing} onClose={() => setEditing(null)} onSave={saveTpl} onPublish={() => publish(editing)} onPreview={() => setPreview(editing)} />
            )}
            {preview && <PreviewModal t={preview} onClose={() => setPreview(null)} />}
        </div>
    );
};

const TemplateEditor = ({ t, onClose, onSave, onPublish, onPreview }) => {
    const [local, setLocal] = useState(t);
    useEffect(() => setLocal(t), [t]);

    const setQ = (idx, patch) => {
        const qs = [...(local.questions || [])];
        qs[idx] = { ...qs[idx], ...patch };
        setLocal({ ...local, questions: qs });
    };
    const addQ = () => setLocal({ ...local, questions: [...(local.questions || []), emptyQ()] });
    const delQ = (idx) => {
        const qs = [...(local.questions || [])];
        qs.splice(idx, 1);
        setLocal({ ...local, questions: qs });
    };
    const move = (idx, dir) => {
        const qs = [...(local.questions || [])];
        const target = idx + dir;
        if (target < 0 || target >= qs.length) return;
        [qs[idx], qs[target]] = [qs[target], qs[idx]];
        setLocal({ ...local, questions: qs });
    };
    const dupQ = (idx) => {
        const qs = [...(local.questions || [])];
        qs.splice(idx + 1, 0, { ...qs[idx], id: crypto.randomUUID() });
        setLocal({ ...local, questions: qs });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
            <div className="glass rounded-2xl p-6 w-full max-w-4xl mx-auto my-6" onClick={(e) => e.stopPropagation()} data-testid="template-editor">
                <div className="flex items-center justify-between mb-4">
                    <div className="font-display text-lg font-semibold">Template editor</div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                    <input placeholder="Name" value={local.name || ""} onChange={(e) => setLocal({ ...local, name: e.target.value })} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm md:col-span-2 outline-none focus:border-[#0055FF]" data-testid="tpl-name-input" />
                    <select value={local.category} onChange={(e) => setLocal({ ...local, category: e.target.value, iterates_faculty: e.target.value === "student" })} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-[#0055FF]" data-testid="tpl-cat-select">
                        <option value="student">Student (multi-faculty)</option>
                        <option value="certification">Certification</option>
                        <option value="faculty">Faculty peer</option>
                        <option value="academic">Academic</option>
                    </select>
                    <textarea placeholder="Description" value={local.description || ""} onChange={(e) => setLocal({ ...local, description: e.target.value })} rows={2} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm md:col-span-3 outline-none focus:border-[#0055FF] resize-none" data-testid="tpl-desc-input" />
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={!!local.iterates_faculty} onChange={(e) => setLocal({ ...local, iterates_faculty: e.target.checked })} data-testid="tpl-iterates-cb" />
                        Ask per faculty member
                    </label>
                    <div className="text-sm text-slate-500">Rating scale: <span className="font-medium text-slate-900">1–{local.rating_scale || 5}</span></div>
                </div>

                <div className="hr-soft my-6" />

                <div className="flex items-center justify-between mb-3">
                    <div className="font-display font-semibold">Questions</div>
                    <button onClick={addQ} className="btn-ghost text-sm inline-flex items-center gap-1.5" data-testid="add-question-btn">
                        <Plus size={14} /> Add question
                    </button>
                </div>

                <div className="space-y-3">
                    {(local.questions || []).map((q, idx) => (
                        <div key={q.id} className="rounded-2xl border border-slate-200 bg-white/70 p-4" data-testid={`q-row-${idx}`}>
                            <div className="flex items-start gap-3">
                                <div className="flex flex-col text-slate-400 pt-1">
                                    <button onClick={() => move(idx, -1)} className="hover:text-slate-700" title="Move up">↑</button>
                                    <span className="text-[10px] text-slate-400">{idx + 1}</span>
                                    <button onClick={() => move(idx, 1)} className="hover:text-slate-700" title="Move down">↓</button>
                                </div>
                                <div className="flex-1">
                                    <input value={q.label} onChange={(e) => setQ(idx, { label: e.target.value })} placeholder="Question label" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" data-testid={`q-label-${idx}`} />
                                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-600">
                                        <select value={q.type} onChange={(e) => setQ(idx, { type: e.target.value })} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none" data-testid={`q-type-${idx}`}>
                                            <option value="rating">Rating (1–5)</option>
                                            <option value="text">Long text</option>
                                        </select>
                                        <label className="inline-flex items-center gap-1.5">
                                            <input type="checkbox" checked={!!q.required} onChange={(e) => setQ(idx, { required: e.target.checked })} data-testid={`q-req-${idx}`} /> Required
                                        </label>
                                        <button onClick={() => dupQ(idx)} className="text-slate-500 hover:text-slate-900">Duplicate</button>
                                        <button onClick={() => delQ(idx)} className="text-rose-600 hover:text-rose-800">Delete</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {(local.questions || []).length === 0 && <div className="text-sm text-slate-400 py-6 text-center">No questions yet — add your first one.</div>}
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onPreview} className="btn-ghost text-sm inline-flex items-center gap-1.5" data-testid="preview-tpl-btn"><Eye size={14} /> Preview</button>
                    <button onClick={() => onSave(local)} className="btn-ghost text-sm" data-testid="save-tpl-btn">Save draft</button>
                    <button onClick={async () => { await onSave(local); await onPublish(); }} className="btn-primary text-sm inline-flex items-center gap-1.5" data-testid="publish-tpl-btn">
                        <CheckCircle2 size={14} /> Publish
                    </button>
                </div>
            </div>
        </div>
    );
};

const PreviewModal = ({ t, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
            <div className="glass rounded-2xl p-6 w-full max-w-2xl mx-auto my-6" onClick={(e) => e.stopPropagation()} data-testid="template-preview">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <div className="text-xs uppercase tracking-widest text-slate-500">Preview</div>
                        <div className="font-display text-lg font-semibold">{t.name}</div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
                </div>
                <p className="text-sm text-slate-600">{t.description}</p>
                <div className="mt-4 space-y-4">
                    {(t.questions || []).map((q, i) => (
                        <div key={q.id} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                            <div className="text-sm font-medium text-slate-900">{i + 1}. {q.label || <span className="text-slate-400">Untitled</span>}{q.required && <span className="text-rose-500"> *</span>}</div>
                            {q.type === "rating" ? (
                                <div className="mt-2 flex gap-1.5">
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <div key={n} className="star-btn"><Star size={18} strokeWidth={1.6} /></div>
                                    ))}
                                </div>
                            ) : (
                                <textarea rows={3} disabled placeholder="Long text response…" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-slate-50" />
                            )}
                        </div>
                    ))}
                    {(t.questions || []).length === 0 && <div className="text-sm text-slate-400 text-center py-6">No questions in this template.</div>}
                </div>
            </div>
        </div>
    );
};

export default TemplatesAdmin;
