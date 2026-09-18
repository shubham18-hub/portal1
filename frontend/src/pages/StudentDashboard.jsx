import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import api, { API_BASE } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle2, Clock, Lock, BookOpen, Award, Users, Building2 } from "lucide-react";

const iconFor = (c) => ({ student: BookOpen, certification: Award, faculty: Users, academic: Building2 }[c] || BookOpen);

const badgeFor = (status) => {
    if (status === "ongoing") return { text: "Ongoing", cls: "bg-emerald-500/15 text-emerald-700 border border-emerald-200" };
    if (status === "completed") return { text: "Completed", cls: "bg-slate-900/5 text-slate-700 border border-slate-200" };
    return { text: "Upcoming", cls: "bg-amber-500/15 text-amber-700 border border-amber-200" };
};

const StudentDashboard = () => {
    const { user, profile } = useAuth();
    const [cats, setCats] = useState([]);
    const [mine, setMine] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [stages, setStages] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [uploadingTask, setUploadingTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refs, setRefs] = useState({});

    useEffect(() => {
        (async () => {
            try {
                const [c, m, p, y, se, di, ay, st, ta, su] = await Promise.all([
                    api.get("/my/categories"),
                    api.get("/feedback/mine").catch(() => ({ data: [] })),
                    api.get("/programs"), api.get("/year_levels"),
                    api.get("/semesters"), api.get("/divisions"), api.get("/academic_years"),
                    api.get("/stages"), api.get("/tasks"),
                    api.get("/submissions/mine").catch(() => ({ data: [] })),
                ]);
                setCats(c.data);
                setMine(m.data.slice(0, 6));
                setPrograms(p.data); setStages(st.data); setTasks(ta.data); setSubmissions(su.data);
                setRefs({
                    programs: p.data, years: y.data, sems: se.data, divs: di.data, ayears: ay.data,
                });
            } finally { setLoading(false); }
        })();
    }, []);

    const nameOf = (arr, id) => arr?.find((x) => x.id === id)?.name || "—";
    const hasProfile = !!profile;

    const uploadTask = async (event, taskId) => {
        const selectedFile = event.target.files?.[0];
        if (!selectedFile) return;
        setUploadingTask(taskId);
        try {
            const formData = new FormData();
            formData.append("file", selectedFile);
            const response = await api.post(`/tasks/${taskId}/submission`, formData);
            setSubmissions((current) => [response.data, ...current]);
        } catch (error) {
            window.alert(error?.response?.data?.detail || "Unable to upload submission");
        } finally { setUploadingTask(null); event.target.value = ""; }
    };

    return (
        <Layout>
            <div className="max-w-6xl mx-auto px-6 pb-16" data-testid="student-dashboard">
                <div className="mb-6">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Welcome back</div>
                    <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">
                        Hello, {user?.name?.split(" ")[0] || "there"}.
                    </h1>
                    <p className="text-slate-600 mt-2 max-w-xl">
                        Your feedback helps us improve teaching and learning.
                    </p>
                </div>

                <section className="mb-8" data-testid="learning-plan">
                    <div className="flex items-end justify-between mb-4">
                        <div>
                            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">MongoDB learning plan</div>
                            <h2 className="font-display text-2xl font-medium tracking-tight text-slate-900">Your programs and tasks</h2>
                        </div>
                        <div className="text-xs text-slate-500">{tasks.length} task{tasks.length === 1 ? "" : "s"}</div>
                    </div>
                    {programs.length === 0 ? (
                        <div className="glass rounded-2xl p-6 text-sm text-slate-500">No programs are available yet.</div>
                    ) : (
                        <div className="space-y-4">
                            {programs.map((program) => {
                                const programStages = stages.filter((stage) => stage.program_id === program.id);
                                return (
                                    <div key={program.id} className="glass rounded-2xl p-5">
                                        <div className="font-display text-lg font-semibold text-slate-900">{program.name}</div>
                                        <div className="text-xs text-slate-500 mt-1">{program.code || "Program"}</div>
                                        <div className="mt-4 grid md:grid-cols-2 gap-3">
                                            {programStages.map((stage) => {
                                                const stageTasks = tasks.filter((task) => task.stage_id === stage.id);
                                                return (
                                                    <div key={stage.id} className="rounded-xl border border-slate-200 bg-white/50 p-4">
                                                        <div className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Stage {stage.order}</div>
                                                        <div className="font-medium text-slate-900 mt-1">{stage.name}</div>
                                                        <div className="mt-3 space-y-2">
                                                            {stageTasks.map((task) => {
                                                                const submission = submissions.find((item) => item.task_id === task.id);
                                                                return <div key={task.id} className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-700" data-testid={`student-task-${task.id}`}>
                                                                    <div className="font-medium">{task.title}</div>
                                                                    <div className="text-xs text-slate-500 mt-1">{task.description}</div>
                                                                    {task.deadline && <div className="text-xs text-slate-500 mt-2">Deadline: {new Date(task.deadline).toLocaleString()}</div>}
                                                                    {submission ? <div className="mt-3 text-xs text-emerald-700"><div className="flex items-center justify-between gap-3"><span>{submission.status === "evaluated" ? `Evaluated · ${submission.marks}/100` : `Submitted · ${new Date(submission.submitted_at).toLocaleString()}`}</span><a href={`${API_BASE}/submissions/${submission.id}/file`} target="_blank" rel="noreferrer" className="font-medium underline">Open PDF</a></div>{submission.status === "evaluated" && submission.feedback && <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-slate-700">{submission.feedback}</div>}</div> : <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"><input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => uploadTask(event, task.id)} disabled={uploadingTask === task.id} />{uploadingTask === task.id ? "Uploading..." : "Upload PDF"}</label>}
                                                                </div>;
                                                            })}
                                                            {stageTasks.length === 0 && <div className="text-xs text-slate-400">No tasks in this stage.</div>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {programStages.length === 0 && <div className="text-sm text-slate-400">No stages in this program yet.</div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {!hasProfile ? (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-8 border border-amber-300/50" data-testid="no-profile-banner">
                        <div className="flex items-start gap-4">
                            <div className="h-11 w-11 rounded-xl bg-amber-500/15 text-amber-700 grid place-items-center shrink-0">
                                <AlertCircle size={18} strokeWidth={1.6} />
                            </div>
                            <div>
                                <div className="font-display text-lg font-semibold text-slate-900">Your academic profile has not been assigned yet.</div>
                                <p className="text-slate-600 mt-1">Please contact the college administration.</p>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <>
                        <div className="glass rounded-2xl p-6 mb-8" data-testid="profile-card">
                            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Your academic profile</div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                                <Field label="Roll No." value={profile.student_id || "—"} testId="profile-rollno" />
                                <Field label="Program" value={nameOf(refs.programs, profile.program_id)} />
                                <Field label="Year" value={nameOf(refs.years, profile.year_level_id)} />
                                <Field label="Semester" value={nameOf(refs.sems, profile.semester_id)} />
                                <Field label="Division" value={nameOf(refs.divs, profile.division_id)} />
                            </div>
                        </div>

                        <div className="mb-4 flex items-end justify-between">
                            <h2 className="font-display text-2xl font-medium tracking-tight text-slate-900">Feedback</h2>
                            <div className="text-xs text-slate-500">Four categories · status updates in real-time</div>
                        </div>

                        {loading ? (
                            <div className="glass rounded-2xl p-8 text-center text-slate-500 text-sm">Loading…</div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-4">
                                {cats.map((c, i) => {
                                    const Icon = iconFor(c.category);
                                    const badge = badgeFor(c.status);
                                    const clickable = c.status === "ongoing" && !c.submitted && c.cycle;
                                    return (
                                        <motion.div key={c.category} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                                            <Link
                                                to={clickable ? `/feedback/cycle/${c.cycle.id}` : "#"}
                                                onClick={(e) => !clickable && e.preventDefault()}
                                                data-testid={`cat-card-${c.category}`}
                                                className={`glass rounded-2xl p-6 flex flex-col gap-3 h-full ${clickable ? "card-lift cursor-pointer" : "opacity-95 cursor-default"}`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-11 w-11 rounded-2xl bg-[#0055FF]/10 text-[#0055FF] grid place-items-center shrink-0">
                                                            <Icon size={18} strokeWidth={1.6} />
                                                        </div>
                                                        <div>
                                                            <div className="font-display text-lg font-semibold text-slate-900">{c.title}</div>
                                                            <div className="text-xs text-slate-500">{c.desc}</div>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${badge.cls}`} data-testid={`cat-status-${c.category}`}>{badge.text}</span>
                                                </div>
                                                <div className="mt-auto flex items-center justify-between text-sm">
                                                    {clickable ? (
                                                        <span className="inline-flex items-center gap-1.5 text-[#0055FF] font-medium">
                                                            {c.has_draft ? "Continue" : "Start feedback"} <ArrowRight size={14} strokeWidth={1.8} />
                                                        </span>
                                                    ) : c.submitted ? (
                                                        <span className="inline-flex items-center gap-1.5 text-emerald-700"><CheckCircle2 size={14} /> Submitted</span>
                                                    ) : c.status === "upcoming" ? (
                                                        <span className="inline-flex items-center gap-1.5 text-slate-500"><Lock size={14} /> Locked · awaiting admin</span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-slate-500"><Clock size={14} /> Closed</span>
                                                    )}
                                                    {c.cycle?.ends_at && <span className="text-xs text-slate-400">Closes {new Date(c.cycle.ends_at).toLocaleDateString()}</span>}
                                                </div>
                                            </Link>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="mt-12">
                            <h2 className="font-display text-2xl font-medium tracking-tight text-slate-900 mb-4">Your recent responses</h2>
                            {mine.length === 0 ? (
                                <div className="glass rounded-2xl p-8 text-center text-slate-500 text-sm">You haven't submitted any feedback yet.</div>
                            ) : (
                                <div className="glass rounded-2xl divide-y divide-slate-200/60 overflow-hidden">
                                    {mine.map((r) => (
                                        <div key={r.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                            <div>
                                                <div className="text-sm font-medium text-slate-900">Submitted</div>
                                                <div className="text-xs text-slate-500">{new Date(r.submitted_at).toLocaleString()}</div>
                                            </div>
                                            <div className="text-sm font-semibold text-[#0055FF]">{r.avg}/5</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
};

const Field = ({ label, value, testId }) => (
    <div data-testid={testId}>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</div>
        <div className="font-medium text-slate-900 mt-1">{value}</div>
    </div>
);

export default StudentDashboard;
