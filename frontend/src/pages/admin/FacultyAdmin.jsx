import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, UserPlus } from "lucide-react";

const emptyAssign = { faculty_id: "", subject_id: "", program_id: "", year_level_id: "", semester_id: "", division_id: "", academic_year_id: "", active: true };

const FacultyAdmin = () => {
    const [faculty, setFaculty] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [depts, setDepts] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [years, setYears] = useState([]);
    const [sems, setSems] = useState([]);
    const [divs, setDivs] = useState([]);
    const [ayears, setAyears] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [fForm, setFForm] = useState({});
    const [aForm, setAForm] = useState(emptyAssign);

    const load = async () => {
        const [f, s, d, p, y, se, di, ay, a] = await Promise.all([
            api.get("/faculty"), api.get("/subjects"), api.get("/departments"), api.get("/programs"),
            api.get("/year_levels"), api.get("/semesters"), api.get("/divisions"),
            api.get("/academic_years"), api.get("/assignments"),
        ]);
        setFaculty(f.data); setSubjects(s.data); setDepts(d.data); setPrograms(p.data);
        setYears(y.data); setSems(se.data); setDivs(di.data); setAyears(ay.data); setAssignments(a.data);
    };
    useEffect(() => { load(); }, []);

    const nameOf = (arr, id) => arr.find((x) => x.id === id)?.name || "—";
    const fname = (uid) => faculty.find((x) => x.user_id === uid)?.name || uid;

    const saveFaculty = async () => {
        try {
            if (fForm.user_id) await api.put(`/faculty/${fForm.user_id}`, fForm);
            else await api.post("/faculty", fForm);
            toast.success("Saved"); setFForm({}); load();
        } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    };

    const saveAssign = async () => {
        try {
            if (aForm.id) await api.put(`/assignments/${aForm.id}`, aForm);
            else await api.post("/assignments", aForm);
            toast.success("Assignment saved"); setAForm(emptyAssign); load();
        } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    };

    const delAssign = async (id) => {
        if (!confirm("Delete assignment?")) return;
        await api.delete(`/assignments/${id}`); toast.success("Deleted"); load();
    };

    return (
        <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Directory</div>
            <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">
                Faculty & assignments
            </h1>

            <div className="grid lg:grid-cols-3 gap-5 mt-6">
                <div className="glass rounded-2xl p-6 lg:col-span-2">
                    <div className="flex items-center justify-between mb-3">
                        <div className="font-display text-lg font-semibold">Faculty</div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-widest text-slate-500 border-b border-slate-200">
                                    <th className="py-2 pr-3">Name</th>
                                    <th className="pr-3">Email</th>
                                    <th className="pr-3">Department</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {faculty.map((f) => (
                                    <tr key={f.user_id} className="border-b border-slate-100" data-testid={`fac-row-${f.user_id}`}>
                                        <td className="py-2 pr-3 font-medium text-slate-900">{f.name}</td>
                                        <td className="pr-3 text-slate-600">{f.email}</td>
                                        <td className="pr-3 text-slate-600">{nameOf(depts, f.department_id)}</td>
                                        <td className="text-right">
                                            <button onClick={() => setFForm(f)} className="p-2 hover:bg-slate-100 rounded-lg"><Pencil size={14} strokeWidth={1.6} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {faculty.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-400">No faculty yet</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="glass rounded-2xl p-6">
                    <div className="font-display text-lg font-semibold mb-3 inline-flex items-center gap-2">
                        <UserPlus size={16} /> {fForm.user_id ? "Edit faculty" : "Add faculty"}
                    </div>
                    <div className="space-y-3">
                        <input placeholder="Full name" value={fForm.name || ""} onChange={(e) => setFForm({ ...fForm, name: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm focus:border-[#0055FF] outline-none" data-testid="fac-name-input" />
                        <input placeholder="College email" value={fForm.email || ""} onChange={(e) => setFForm({ ...fForm, email: e.target.value })} disabled={!!fForm.user_id} className="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm focus:border-[#0055FF] outline-none disabled:opacity-60" data-testid="fac-email-input" />
                        <select value={fForm.department_id || ""} onChange={(e) => setFForm({ ...fForm, department_id: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm focus:border-[#0055FF] outline-none" data-testid="fac-dept-select">
                            <option value="">Department</option>
                            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <div className="flex gap-2">
                            <button onClick={saveFaculty} className="btn-primary text-sm inline-flex items-center gap-1.5" data-testid="save-faculty-btn">
                                <Plus size={14} /> {fForm.user_id ? "Save" : "Add"}
                            </button>
                            {fForm.user_id && <button onClick={() => setFForm({})} className="btn-ghost text-sm">Cancel</button>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Assignments */}
            <div className="glass rounded-2xl p-6 mt-8">
                <div className="font-display text-lg font-semibold mb-4">Faculty assignments</div>
                <div className="grid md:grid-cols-3 lg:grid-cols-8 gap-2">
                    {[
                        { k: "faculty_id", ph: "Faculty", opts: faculty.map((f) => ({ id: f.user_id, name: f.name })) },
                        { k: "subject_id", ph: "Subject", opts: subjects },
                        { k: "program_id", ph: "Program", opts: programs },
                        { k: "year_level_id", ph: "Year", opts: years },
                        { k: "semester_id", ph: "Semester", opts: sems },
                        { k: "division_id", ph: "Division", opts: divs },
                        { k: "academic_year_id", ph: "Academic Year", opts: ayears },
                    ].map((f) => (
                        <select key={f.k} value={aForm[f.k] || ""} onChange={(e) => setAForm({ ...aForm, [f.k]: e.target.value })}
                            className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 text-sm focus:border-[#0055FF] outline-none"
                            data-testid={`assign-${f.k}`}
                        >
                            <option value="">{f.ph}</option>
                            {f.opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                    ))}
                    <button onClick={saveAssign} className="btn-primary text-sm inline-flex items-center gap-1.5" data-testid="save-assign-btn">
                        <Plus size={14} /> {aForm.id ? "Save" : "Assign"}
                    </button>
                </div>

                <div className="overflow-x-auto mt-6">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-widest text-slate-500 border-b border-slate-200">
                                <th className="py-2 pr-3">Faculty</th>
                                <th className="pr-3">Subject</th>
                                <th className="pr-3">Program</th>
                                <th className="pr-3">Year</th>
                                <th className="pr-3">Semester</th>
                                <th className="pr-3">Division</th>
                                <th className="pr-3">Academic Year</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {assignments.map((a) => (
                                <tr key={a.id} className="border-b border-slate-100" data-testid={`assign-row-${a.id}`}>
                                    <td className="py-2 pr-3 font-medium text-slate-900">{fname(a.faculty_id)}</td>
                                    <td className="pr-3 text-slate-600">{nameOf(subjects, a.subject_id)}</td>
                                    <td className="pr-3 text-slate-600">{nameOf(programs, a.program_id)}</td>
                                    <td className="pr-3 text-slate-600">{nameOf(years, a.year_level_id)}</td>
                                    <td className="pr-3 text-slate-600">{nameOf(sems, a.semester_id)}</td>
                                    <td className="pr-3 text-slate-600">{nameOf(divs, a.division_id)}</td>
                                    <td className="pr-3 text-slate-600">{nameOf(ayears, a.academic_year_id)}</td>
                                    <td className="text-right">
                                        <button onClick={() => setAForm(a)} className="p-2 hover:bg-slate-100 rounded-lg"><Pencil size={14} strokeWidth={1.6} /></button>
                                        <button onClick={() => delAssign(a.id)} className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg"><Trash2 size={14} strokeWidth={1.6} /></button>
                                    </td>
                                </tr>
                            ))}
                            {assignments.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-slate-400">No assignments yet</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FacultyAdmin;
