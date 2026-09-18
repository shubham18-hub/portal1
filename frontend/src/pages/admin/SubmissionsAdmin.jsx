import React, { useEffect, useState } from "react";
import api, { API_BASE } from "@/lib/api";
import { Download, RefreshCw } from "lucide-react";

const SubmissionsAdmin = () => {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [marks, setMarks] = useState("");
    const [feedback, setFeedback] = useState("");

    const load = async () => {
        setLoading(true);
        try {
            const response = await api.get("/submissions");
            setSubmissions(response.data);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const startEvaluation = (submission) => {
        setEditing(submission);
        setMarks(submission.marks ?? "");
        setFeedback(submission.feedback || "");
    };

    const saveEvaluation = async () => {
        const response = await api.put(`/submissions/${editing.id}/evaluation`, { marks: Number(marks), feedback });
        setSubmissions((current) => current.map((item) => item.id === response.data.id ? response.data : item));
        setEditing(null);
    };

    return (
        <div>
            <div className="flex items-end justify-between gap-4">
                <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Student work</div>
                    <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">Submissions</h1>
                    <p className="text-slate-600 mt-1">Review real PDFs stored through the submission workflow.</p>
                </div>
                <button onClick={load} className="btn-ghost text-sm inline-flex items-center gap-1.5" title="Refresh submissions"><RefreshCw size={14} /> Refresh</button>
            </div>
            <div className="glass rounded-2xl p-4 mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs uppercase tracking-widest text-slate-500 border-b border-slate-200"><th className="py-2 pr-3">Student</th><th className="pr-3">Task</th><th className="pr-3">Submitted</th><th className="pr-3">Status</th><th className="text-right">PDF</th></tr></thead>
                    <tbody>
                        {submissions.map((submission) => <tr key={submission.id} className="border-b border-slate-100" data-testid={`submission-row-${submission.id}`}>
                            <td className="py-3 pr-3"><div className="font-medium text-slate-900">{submission.student_name}</div><div className="text-xs text-slate-500">{submission.student_email}</div></td>
                            <td className="pr-3 text-slate-700">{submission.task_title}</td>
                            <td className="pr-3 text-slate-600">{new Date(submission.submitted_at).toLocaleString()}</td>
                            <td className="pr-3"><span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">{submission.status}</span>{submission.marks != null && <div className="text-xs text-slate-500 mt-1">{submission.marks}/100</div>}</td>
                            <td className="text-right space-x-2"><a href={`${API_BASE}/submissions/${submission.id}/file`} target="_blank" rel="noreferrer" className="btn-ghost text-sm inline-flex items-center gap-1.5"><Download size={14} /> Open PDF</a><button onClick={() => startEvaluation(submission)} className="btn-primary text-sm">{submission.status === "evaluated" ? "Edit evaluation" : "Evaluate"}</button></td>
                        </tr>)}
                        {!loading && submissions.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400">No student submissions yet</td></tr>}
                        {loading && <tr><td colSpan={5} className="py-8 text-center text-slate-400">Loading submissions...</td></tr>}
                    </tbody>
                </table>
            </div>
            {editing && <div className="glass rounded-2xl p-5 mt-5 max-w-2xl">
                <div className="font-display text-lg font-semibold">Evaluate {editing.task_title}</div>
                <div className="text-sm text-slate-500 mt-1">{editing.student_name} · {editing.student_email}</div>
                <div className="mt-4 space-y-3">
                    <input type="number" min="0" max="100" value={marks} onChange={(event) => setMarks(event.target.value)} placeholder="Marks out of 100" className="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-[#0055FF]" data-testid="evaluation-marks-input" />
                    <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Feedback for the student" rows={4} className="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-[#0055FF] resize-y" data-testid="evaluation-feedback-input" />
                    <div className="flex gap-2"><button onClick={saveEvaluation} disabled={marks === ""} className="btn-primary text-sm" data-testid="save-evaluation-button">Save evaluation</button><button onClick={() => setEditing(null)} className="btn-ghost text-sm">Cancel</button></div>
                </div>
            </div>}
        </div>
    );
};

export default SubmissionsAdmin;
