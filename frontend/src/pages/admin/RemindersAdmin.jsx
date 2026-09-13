import React, { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Bell, Send, Info } from "lucide-react";

const RemindersAdmin = () => {
    const [days, setDays] = useState(2);
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);

    const run = async (dry = true) => {
        setBusy(true);
        try {
            if (dry) {
                const r = await api.get(`/reminders/preview?days_before=${days}`);
                setPreview(r.data);
            } else {
                const r = await api.post(`/reminders/run?days_before=${days}&dry_run=false`);
                toast.success(`Reminders sent: ${r.data.sent}`);
                const p = await api.get(`/reminders/preview?days_before=${days}`);
                setPreview(p.data);
            }
        } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
        finally { setBusy(false); }
    };

    return (
        <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Communication</div>
            <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">Reminders</h1>
            <p className="text-slate-600 mt-1">Email students who started but didn't submit their feedback yet.</p>

            <div className="glass rounded-2xl p-6 mt-6 flex flex-wrap items-end gap-3">
                <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">Days before close</div>
                    <input type="number" min={0} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-24 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" data-testid="reminder-days" />
                </div>
                <button onClick={() => run(true)} disabled={busy} className="btn-ghost text-sm inline-flex items-center gap-1.5" data-testid="reminder-preview-btn">
                    <Bell size={14} /> Preview
                </button>
                <button onClick={() => run(false)} disabled={busy} className="btn-primary text-sm inline-flex items-center gap-1.5" data-testid="reminder-send-btn">
                    <Send size={14} /> Send now
                </button>
            </div>

            {preview && (
                <>
                    {!preview.email_configured && (
                        <div className="glass rounded-2xl p-4 mt-4 border border-amber-300/50 text-sm text-amber-800 inline-flex items-start gap-2" data-testid="email-not-configured">
                            <Info size={14} className="mt-0.5" />
                            <div>
                                Email delivery not configured yet. Set the following environment variables to enable sending:
                                <ul className="list-disc ml-5 mt-1">
                                    <li><code>RESEND_API_KEY</code></li>
                                    <li><code>REMINDER_FROM_EMAIL</code></li>
                                </ul>
                                Until then, "Send now" will only mark candidates without actually delivering emails.
                            </div>
                        </div>
                    )}

                    <div className="glass rounded-2xl p-6 mt-4 overflow-x-auto">
                        <div className="text-sm text-slate-600 mb-3"><span data-testid="reminder-count">{preview.count}</span> candidate(s)</div>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-widest text-slate-500 border-b border-slate-200">
                                    <th className="py-2 pr-3">Student</th>
                                    <th className="pr-3">Email</th>
                                    <th className="pr-3">Cycle</th>
                                    <th className="pr-3">Closes</th>
                                    <th className="pr-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.recipients.map((r, i) => (
                                    <tr key={i} className="border-b border-slate-100" data-testid={`reminder-row-${i}`}>
                                        <td className="py-2 pr-3 font-medium text-slate-900">{r.name}</td>
                                        <td className="pr-3 text-slate-600">{r.email}</td>
                                        <td className="pr-3 text-slate-600">{r.cycle_name}</td>
                                        <td className="pr-3 text-slate-500">{r.ends_at?.slice(0, 10)}</td>
                                        <td className="pr-3">
                                            {r.already_reminded ? <span className="text-xs text-emerald-700">Reminded</span> : <span className="text-xs text-amber-700">Pending</span>}
                                        </td>
                                    </tr>
                                ))}
                                {preview.recipients.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-400">No candidates for this window</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};

export default RemindersAdmin;
