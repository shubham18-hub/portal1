import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Pencil, Upload, X, FileText } from "lucide-react";

const StudentsAdmin = () => {
    const [students, setStudents] = useState([]);
    const [depts, setDepts] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [years, setYears] = useState([]);
    const [sems, setSems] = useState([]);
    const [divs, setDivs] = useState([]);
    const [ayears, setAyears] = useState([]);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({});
    const [importOpen, setImportOpen] = useState(false);
    const [csvText, setCsvText] = useState("");
    const [importResult, setImportResult] = useState(null);
    const [importBusy, setImportBusy] = useState(false);

    const load = async () => {
        const [s, d, p, y, se, di, ay] = await Promise.all([
            api.get("/students"), api.get("/departments"), api.get("/programs"),
            api.get("/year_levels"), api.get("/semesters"), api.get("/divisions"), api.get("/academic_years"),
        ]);
        setStudents(s.data); setDepts(d.data); setPrograms(p.data); setYears(y.data); setSems(se.data); setDivs(di.data); setAyears(ay.data);
    };
    useEffect(() => { load(); }, []);

    const nameOf = (arr, id) => arr.find((x) => x.id === id)?.name || "—";
    const openEdit = (s) => {
        setEditing(s);
        setForm({ user_id: s.user_id, ...(s.profile || {}) });
    };
    const save = async () => {
        try {
            await api.post("/students/profile", form);
            toast.success("Profile saved"); setEditing(null); load();
        } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    };

    const onFile = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => setCsvText(String(reader.result || ""));
        reader.readAsText(f);
    };

    const runImport = async (dry_run) => {
        setImportBusy(true);
        try {
            const r = await api.post("/students/import", { csv: csvText, dry_run });
            setImportResult(r.data);
            if (!dry_run) {
                toast.success(`Imported ${r.data.imported}, updated ${r.data.updated}`);
                load();
            }
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Failed");
        } finally { setImportBusy(false); }
    };

    return (
        <div>
            <div className="flex items-end justify-between gap-4">
                <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">People</div>
                    <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">Students</h1>
                    <p className="text-slate-600 mt-1">Assign academic profiles. Students cannot self-assign these.</p>
                </div>
                <button onClick={() => { setImportOpen(true); setImportResult(null); setCsvText(""); }} className="btn-primary text-sm inline-flex items-center gap-1.5" data-testid="import-csv-btn">
                    <Upload size={14} /> Import CSV
                </button>
            </div>

            <div className="glass rounded-2xl p-6 mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-widest text-slate-500 border-b border-slate-200">
                            <th className="py-2 pr-3">Student ID</th>
                            <th className="pr-3">Name</th>
                            <th className="pr-3">Email</th>
                            <th className="pr-3">Program</th>
                            <th className="pr-3">Year</th>
                            <th className="pr-3">Semester</th>
                            <th className="pr-3">Division</th>
                            <th className="pr-3">Academic Year</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((s) => (
                            <tr key={s.user_id} className="border-b border-slate-100" data-testid={`student-row-${s.user_id}`}>
                                <td className="py-2 pr-3 text-slate-600 font-mono text-xs">{s.profile?.student_id || "—"}</td>
                                <td className="pr-3 font-medium text-slate-900">{s.name}</td>
                                <td className="pr-3 text-slate-600">{s.email}</td>
                                <td className="pr-3 text-slate-600">{nameOf(programs, s.profile?.program_id)}</td>
                                <td className="pr-3 text-slate-600">{nameOf(years, s.profile?.year_level_id)}</td>
                                <td className="pr-3 text-slate-600">{nameOf(sems, s.profile?.semester_id)}</td>
                                <td className="pr-3 text-slate-600">{nameOf(divs, s.profile?.division_id)}</td>
                                <td className="pr-3 text-slate-600">{nameOf(ayears, s.profile?.academic_year_id)}</td>
                                <td className="text-right">
                                    <button onClick={() => openEdit(s)} className="p-2 hover:bg-slate-100 rounded-lg" data-testid={`edit-student-${s.user_id}`}>
                                        <Pencil size={14} strokeWidth={1.6} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {students.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-slate-400">No students yet — they'll appear here after their first login</td></tr>}
                    </tbody>
                </table>
            </div>

            {importOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4" onClick={() => setImportOpen(false)}>
                    <div className="glass rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="import-modal">
                        <div className="flex items-center justify-between mb-3">
                            <div className="font-display text-lg font-semibold inline-flex items-center gap-2"><FileText size={16} /> Bulk import students (CSV)</div>
                            <button onClick={() => setImportOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
                        </div>
                        <p className="text-sm text-slate-600 mb-4">
                            CSV columns (header row required): <code>student_id, name, email, program, year, semester, division, academic_year</code>.
                            Values must match existing academic entities by name (e.g. "BBA", "2nd Year", "Semester 3", "A", "2025-2026").
                        </p>
                        <div className="flex items-center gap-3">
                            <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm" data-testid="csv-file-input" />
                            <span className="text-xs text-slate-500">or paste below</span>
                        </div>
                        <textarea rows={8} value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder="student_id,name,email,program,year,semester,division,academic_year&#10;S001,Aisha Kumar,aisha@klecba.edu.in,BBA,2nd Year,Semester 3,A,2025-2026" className="mt-3 w-full font-mono text-xs rounded-xl border border-slate-200 bg-white/80 px-4 py-3 outline-none focus:border-[#0055FF] resize-y" data-testid="csv-text-input" />
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => runImport(true)} disabled={!csvText || importBusy} className="btn-ghost text-sm" data-testid="csv-validate-btn">Validate</button>
                            <button onClick={() => runImport(false)} disabled={!csvText || importBusy} className="btn-primary text-sm" data-testid="csv-import-btn">Import</button>
                        </div>

                        {importResult && (
                            <div className="mt-5 space-y-3" data-testid="import-result">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <Stat label="Valid" value={importResult.valid_count} />
                                    <Stat label="Invalid" value={importResult.invalid_count} tone="rose" />
                                    <Stat label="Imported" value={importResult.imported} tone="emerald" />
                                    <Stat label="Updated" value={importResult.updated} tone="blue" />
                                </div>
                                {importResult.invalid_rows?.length > 0 && (
                                    <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs">
                                        <div className="font-medium text-rose-800 mb-1">Errors</div>
                                        <ul className="space-y-1 max-h-40 overflow-auto">
                                            {importResult.invalid_rows.map((r) => (
                                                <li key={r.row} className="text-rose-700">Row {r.row} ({r.email || "no email"}): {r.errors.join("; ")}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {editing && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4" onClick={() => setEditing(null)}>
                    <div className="glass rounded-2xl p-6 w-full max-w-2xl" onClick={(e) => e.stopPropagation()} data-testid="student-profile-modal">
                        <div className="flex items-center justify-between mb-4">
                            <div className="font-display text-lg font-semibold">Assign profile — {editing.name}</div>
                            <button onClick={() => setEditing(null)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <input placeholder="Student ID" value={form.student_id || ""} onChange={(e) => setForm({ ...form, student_id: e.target.value })} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm focus:border-[#0055FF] outline-none" data-testid="stu-id-input" />
                            {[
                                { k: "department_id", ph: "Department", opts: depts },
                                { k: "program_id", ph: "Program", opts: programs },
                                { k: "year_level_id", ph: "Year", opts: years },
                                { k: "semester_id", ph: "Semester", opts: sems },
                                { k: "division_id", ph: "Division", opts: divs },
                                { k: "academic_year_id", ph: "Academic Year", opts: ayears },
                            ].map((f) => (
                                <select key={f.k} value={form[f.k] || ""} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}
                                    className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm focus:border-[#0055FF] outline-none"
                                    data-testid={`stu-${f.k}`}
                                >
                                    <option value="">{f.ph}</option>
                                    {f.opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                                </select>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setEditing(null)} className="btn-ghost text-sm">Cancel</button>
                            <button onClick={save} className="btn-primary text-sm" data-testid="save-student-profile-btn">Save profile</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentsAdmin;

const Stat = ({ label, value, tone = "slate" }) => {
    const map = { slate: "text-slate-900", rose: "text-rose-700", emerald: "text-emerald-700", blue: "text-[#0055FF]" };
    return (
        <div className="rounded-xl bg-white/60 border border-slate-200 p-3 text-center">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
            <div className={`font-display text-2xl font-medium ${map[tone]}`}>{value}</div>
        </div>
    );
};
