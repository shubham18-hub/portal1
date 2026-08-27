import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";

const EventsAdmin = () => {
    const [events, setEvents] = useState([]);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({});

    const load = async () => setEvents((await api.get("/events")).data);
    useEffect(() => { load(); }, []);

    const toLocal = (iso) => (iso ? iso.slice(0, 16) : "");
    const openEdit = (e) => { setEditing(e || {}); setForm(e ? { ...e, starts_at: toLocal(e.starts_at), ends_at: toLocal(e.ends_at) } : { feedback_type: "academic", active: true }); };
    const save = async () => {
        try {
            const body = { ...form, starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString() };
            if (form.id) await api.put(`/events/${form.id}`, body); else await api.post("/events", body);
            toast.success("Saved"); setEditing(null); load();
        } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    };
    const del = async (id) => {
        if (!confirm("Delete?")) return;
        await api.delete(`/events/${id}`); toast.success("Deleted"); load();
    };

    return (
        <div>
            <div className="flex items-end justify-between gap-4">
                <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Campus</div>
                    <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">Events</h1>
                    <p className="text-slate-600 mt-1">Seminars, workshops and activities.</p>
                </div>
                <button onClick={() => openEdit(null)} className="btn-primary text-sm inline-flex items-center gap-1.5" data-testid="new-event-btn">
                    <Plus size={14} /> New event
                </button>
            </div>

            <div className="glass rounded-2xl p-6 mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-widest text-slate-500 border-b border-slate-200">
                            <th className="py-2 pr-3">Title</th>
                            <th className="pr-3">Speaker</th>
                            <th className="pr-3">Starts</th>
                            <th className="pr-3">Type</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.map((e) => (
                            <tr key={e.id} className="border-b border-slate-100" data-testid={`ev-row-${e.id}`}>
                                <td className="py-2 pr-3 font-medium text-slate-900">{e.title}</td>
                                <td className="pr-3 text-slate-600">{e.speaker}</td>
                                <td className="pr-3 text-slate-600">{new Date(e.starts_at).toLocaleString()}</td>
                                <td className="pr-3 text-slate-600 capitalize">{e.feedback_type}</td>
                                <td className="text-right">
                                    <button onClick={() => openEdit(e)} className="p-2 hover:bg-slate-100 rounded-lg"><Pencil size={14} strokeWidth={1.6} /></button>
                                    <button onClick={() => del(e.id)} className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg"><Trash2 size={14} strokeWidth={1.6} /></button>
                                </td>
                            </tr>
                        ))}
                        {events.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400">No events yet</td></tr>}
                    </tbody>
                </table>
            </div>

            {editing && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setEditing(null)}>
                    <div className="glass rounded-2xl p-6 w-full max-w-lg mx-auto my-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="font-display text-lg font-semibold">{form.id ? "Edit event" : "New event"}</div>
                            <button onClick={() => setEditing(null)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
                        </div>
                        <div className="space-y-3">
                            <input placeholder="Title" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-[#0055FF]" data-testid="ev-title-input" />
                            <textarea placeholder="Description" rows={3} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-[#0055FF] resize-none" />
                            <div className="grid grid-cols-2 gap-2">
                                <input placeholder="Venue" value={form.venue || ""} onChange={(e) => setForm({ ...form, venue: e.target.value })} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-[#0055FF]" />
                                <input placeholder="Speaker" value={form.speaker || ""} onChange={(e) => setForm({ ...form, speaker: e.target.value })} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-[#0055FF]" />
                                <input type="datetime-local" value={form.starts_at || ""} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-[#0055FF]" />
                                <input type="datetime-local" value={form.ends_at || ""} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-[#0055FF]" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setEditing(null)} className="btn-ghost text-sm">Cancel</button>
                            <button onClick={save} className="btn-primary text-sm" data-testid="save-event-btn">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EventsAdmin;
