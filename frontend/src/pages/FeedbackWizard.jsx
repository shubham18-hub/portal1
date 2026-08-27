import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import StarRating from "@/components/StarRating";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const FeedbackWizard = () => {
    const { cycleId } = useParams();
    const nav = useNavigate();
    const [ctx, setCtx] = useState(null);
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState({}); // {assignment_id or 'general': {question_id: value}}
    const [busy, setBusy] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const saveTimer = useRef(null);
    const [savedTick, setSavedTick] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const r = await api.get(`/my/cycles/${cycleId}/context`);
                setCtx(r.data);
                if (r.data.submitted) { setSubmitted(true); return; }
                if (r.data.draft) {
                    setAnswers(r.data.draft.answers || {});
                    setStep(r.data.draft.step || 0);
                }
            } catch (e) {
                toast.error(e?.response?.data?.detail || "Unable to load feedback");
                nav("/dashboard", { replace: true });
            }
        })();
    }, [cycleId, nav]);

    const iterates = ctx?.template_version?.iterates_faculty;
    const steps = useMemo(() => {
        if (!ctx) return [];
        if (iterates) {
            return [
                ...ctx.faculty_items.map((f) => ({ kind: "faculty", key: f.assignment_id, item: f })),
                { kind: "review", key: "review" },
            ];
        }
        return [{ kind: "general", key: "general" }, { kind: "review", key: "review" }];
    }, [ctx, iterates]);

    const totalRateable = useMemo(() => {
        if (!ctx) return 0;
        const qs = ctx.template_version.questions || [];
        const perTeacher = qs.length;
        return iterates ? perTeacher * ctx.faculty_items.length : perTeacher;
    }, [ctx, iterates]);

    const filled = useMemo(() => {
        let n = 0;
        Object.values(answers).forEach((group) => {
            if (typeof group !== "object" || !group) return;
            Object.values(group).forEach((v) => { if (v !== undefined && v !== "" && v !== null) n += 1; });
        });
        return n;
    }, [answers]);

    const progress = totalRateable ? Math.round((filled / totalRateable) * 100) : 0;

    const setAns = (groupKey, qid, val) => {
        setAnswers((prev) => ({ ...prev, [groupKey]: { ...(prev[groupKey] || {}), [qid]: val } }));
    };

    // Autosave
    useEffect(() => {
        if (!ctx || submitted) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            try {
                await api.post(`/my/cycles/${cycleId}/draft`, { answers, step });
                setSavedTick(true);
                setTimeout(() => setSavedTick(false), 1200);
            } catch { /* silent */ }
        }, 700);
        return () => saveTimer.current && clearTimeout(saveTimer.current);
    }, [answers, step, ctx, cycleId, submitted]);

    const current = steps[step];

    const validateStep = () => {
        if (!current || current.kind === "review") return true;
        const qs = ctx.template_version.questions || [];
        const groupKey = current.kind === "faculty" ? current.item.assignment_id : "general";
        const grp = answers[groupKey] || {};
        for (const q of qs) {
            if (q.required && (grp[q.id] === undefined || grp[q.id] === "" || grp[q.id] === null)) {
                toast.error(`Please answer: ${q.label}`);
                return false;
            }
        }
        return true;
    };

    const next = () => { if (validateStep()) setStep((s) => Math.min(steps.length - 1, s + 1)); };
    const back = () => setStep((s) => Math.max(0, s - 1));

    const allComplete = useMemo(() => {
        if (!ctx) return false;
        const qs = ctx.template_version.questions || [];
        const req = qs.filter((q) => q.required);
        if (!req.length) return true;
        const check = (grp) => req.every((q) => {
            const v = grp?.[q.id];
            return v !== undefined && v !== null && v !== "";
        });
        if (iterates) return ctx.faculty_items.every((f) => check(answers[f.assignment_id]));
        return check(answers.general);
    }, [ctx, iterates, answers]);

    const submit = async () => {
        if (!allComplete) {
            toast.error("Please complete every required answer before submitting");
            return;
        }
        setBusy(true);
        try {
            const res = await api.post(`/my/cycles/${cycleId}/submit`, {
                answers,
                faculty_items: ctx.faculty_items,
            });
            setSubmitted(true);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Failed to submit");
        } finally {
            setBusy(false);
        }
    };

    if (!ctx) {
        return (
            <Layout>
                <div className="max-w-2xl mx-auto py-24 grid place-items-center text-slate-500">
                    <Loader2 className="animate-spin" size={18} />
                </div>
            </Layout>
        );
    }

    if (submitted) {
        return (
            <Layout>
                <div className="max-w-2xl mx-auto px-6 pb-24">
                    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-3xl p-10 text-center" data-testid="feedback-submitted">
                        <div className="mx-auto h-16 w-16 rounded-full bg-[#0055FF]/10 text-[#0055FF] grid place-items-center mb-4">
                            <svg className="checkmark" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 12l5 5L20 6" />
                            </svg>
                        </div>
                        <div className="font-display text-2xl font-medium tracking-tight text-slate-900">Thank you.</div>
                        <p className="text-slate-600 mt-2 max-w-md mx-auto">Your feedback has been submitted successfully.</p>
                        <button onClick={() => nav("/dashboard")} className="btn-primary text-sm mt-6" data-testid="back-home-btn">Back to dashboard</button>
                    </motion.div>
                </div>
            </Layout>
        );
    }

    const qs = ctx.template_version.questions || [];

    return (
        <Layout>
            <div className="max-w-3xl mx-auto px-6 pb-24" data-testid="feedback-wizard">
                <button onClick={() => nav("/dashboard")} className="text-sm text-slate-500 inline-flex items-center gap-1 mb-6 hover:text-slate-900">
                    <ArrowLeft size={14} /> Back
                </button>

                <div className="glass rounded-3xl p-6 md:p-8">
                    <div className="flex items-center justify-between mb-2 text-xs">
                        <div className="text-slate-500 uppercase tracking-widest">
                            {iterates ? `Faculty ${Math.min(step + 1, ctx.faculty_items.length)} of ${ctx.faculty_items.length}` : ctx.template_version.name}
                        </div>
                        <div className="text-slate-500 flex items-center gap-2">
                            {savedTick && <span className="text-emerald-600 inline-flex items-center gap-1"><Save size={12} /> Saved</span>}
                            {progress}% completed
                        </div>
                    </div>
                    <Progress value={progress} className="h-1.5" />

                    <h1 className="font-display text-2xl md:text-3xl font-medium tracking-tight text-slate-900 mt-6">
                        {ctx.cycle.name}
                    </h1>
                    {ctx.template_version.description && <p className="text-slate-600 mt-2">{ctx.template_version.description}</p>}

                    <div className="mt-8">
                        <AnimatePresence mode="wait">
                            <motion.div key={current?.key || "review"} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }}>
                                {current?.kind === "faculty" && (
                                    <>
                                        <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#0055FF] mb-2">Faculty {step + 1} / {ctx.faculty_items.length}</div>
                                        <div className="font-display text-xl font-semibold text-slate-900">{current.item.faculty_name}</div>
                                        <div className="text-sm text-slate-600">{current.item.subject_name}</div>
                                        <div className="mt-6 space-y-5">
                                            {qs.map((q) => (
                                                <QuestionRow key={q.id} q={q} value={(answers[current.item.assignment_id] || {})[q.id]} onChange={(v) => setAns(current.item.assignment_id, q.id, v)} />
                                            ))}
                                        </div>
                                    </>
                                )}
                                {current?.kind === "general" && (
                                    <div className="mt-2 space-y-5">
                                        {qs.map((q) => (
                                            <QuestionRow key={q.id} q={q} value={(answers.general || {})[q.id]} onChange={(v) => setAns("general", q.id, v)} />
                                        ))}
                                    </div>
                                )}
                                {current?.kind === "review" && (
                                    <ReviewStep ctx={ctx} answers={answers} iterates={iterates} onEdit={(i) => setStep(i)} />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <div className="hr-soft my-8" />

                    <div className="flex items-center justify-between">
                        <button onClick={back} disabled={step === 0} className="btn-ghost text-sm inline-flex items-center gap-1.5 disabled:opacity-40" data-testid="wizard-back-btn">
                            <ArrowLeft size={14} /> Back
                        </button>
                        {current?.kind === "review" ? (
                            <button onClick={submit} disabled={busy || !allComplete} className="btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed" data-testid="wizard-submit-btn">
                                {busy ? "Submitting…" : "Submit feedback"} <CheckCircle2 size={14} />
                            </button>
                        ) : (
                            <button onClick={next} className="btn-primary text-sm inline-flex items-center gap-1.5" data-testid="wizard-next-btn">
                                Next <ArrowRight size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
};

const QuestionRow = ({ q, value, onChange }) => (
    <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between border-b border-slate-100 pb-4">
        <div className="flex-1">
            <div className="font-medium text-slate-900">{q.label}{q.required && <span className="text-rose-500"> *</span>}</div>
            {q.type === "rating" && <div className="text-xs text-slate-500 mt-0.5">Tap a star to rate 1 (low) to 5 (high)</div>}
        </div>
        {q.type === "rating" ? (
            <StarRating value={Number(value) || 0} onChange={(v) => onChange(v)} testId={`rating-${q.id}`} />
        ) : (
            <textarea rows={3} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="Your answer" className="w-full md:w-96 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[#0055FF] resize-none" data-testid={`text-${q.id}`} />
        )}
    </div>
);

const ReviewStep = ({ ctx, answers, iterates, onEdit }) => {
    const qs = ctx.template_version.questions || [];
    const groups = iterates
        ? ctx.faculty_items.map((f, i) => ({ title: f.faculty_name, subtitle: f.subject_name, key: f.assignment_id, idx: i }))
        : [{ title: ctx.template_version.name, subtitle: "General", key: "general", idx: 0 }];
    return (
        <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Review</div>
            <div className="font-display text-2xl font-medium tracking-tight text-slate-900">Confirm your feedback</div>
            <p className="text-slate-600 text-sm mt-1">Check each section, then submit. This is final.</p>
            <div className="mt-6 space-y-3">
                {groups.map((g) => {
                    const grp = answers[g.key] || {};
                    const answered = qs.filter((q) => grp[q.id] !== undefined && grp[q.id] !== "" && grp[q.id] !== null).length;
                    const total = qs.length;
                    const complete = answered === total;
                    return (
                        <div key={g.key} className="glass rounded-2xl p-4 flex items-center justify-between" data-testid={`review-row-${g.key}`}>
                            <div>
                                <div className="font-medium text-slate-900">{g.title}</div>
                                <div className="text-xs text-slate-500">{g.subtitle} · {answered}/{total} answered</div>
                            </div>
                            <div className="flex items-center gap-2">
                                {complete ? <span className="text-emerald-600 text-sm inline-flex items-center gap-1"><CheckCircle2 size={14} /> Complete</span> : <span className="text-amber-600 text-sm">Incomplete</span>}
                                <button onClick={() => onEdit(g.idx)} className="btn-ghost text-xs" data-testid={`review-edit-${g.key}`}>Edit</button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FeedbackWizard;
