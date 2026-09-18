import React, { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

const emptyTask = { title: "", description: "", deadline: "", order: 1 };

const TasksAdmin = () => {
    const [programs, setPrograms] = useState([]);
    const [stages, setStages] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [programId, setProgramId] = useState("");
    const [stageForm, setStageForm] = useState({ name: "", order: 1 });
    const [taskForm, setTaskForm] = useState(emptyTask);
    const [stageId, setStageId] = useState("");

    const loadPrograms = useCallback(async () => {
        const response = await api.get("/programs");
        setPrograms(response.data);
        setProgramId((current) => current || response.data[0]?.id || "");
    }, []);

    const loadContent = useCallback(async () => {
        if (!programId) {
            setStages([]); setTasks([]); return;
        }
        const [stageResponse, taskResponse] = await Promise.all([
            api.get(`/stages?program_id=${encodeURIComponent(programId)}`),
            api.get(`/tasks?program_id=${encodeURIComponent(programId)}`),
        ]);
        setStages(stageResponse.data);
        setTasks(taskResponse.data);
        setStageId((current) => current || stageResponse.data[0]?.id || "");
    }, [programId]);

    useEffect(() => { loadPrograms(); }, [loadPrograms]);
    useEffect(() => { loadContent(); }, [loadContent]);

    const addStage = async () => {
        try {
            const response = await api.post("/stages", { ...stageForm, program_id: programId });
            setStages((current) => [...current, response.data].sort((a, b) => a.order - b.order));
            setStageId(response.data.id);
            setStageForm({ name: "", order: 1 });
            toast.success("Stage created");
        } catch (error) { toast.error(error?.response?.data?.detail || "Could not create stage"); }
    };

    const saveTask = async () => {
        try {
            const payload = { ...taskForm, stage_id: stageId };
            const response = taskForm.id
                ? await api.put(`/tasks/${taskForm.id}`, payload)
                : await api.post("/tasks", payload);
            setTasks((current) => {
                const next = taskForm.id ? current.map((task) => task.id === response.data.id ? response.data : task) : [...current, response.data];
                return next.sort((a, b) => a.order - b.order);
            });
            setTaskForm(emptyTask);
            toast.success(taskForm.id ? "Task updated" : "Task created");
        } catch (error) { toast.error(error?.response?.data?.detail || "Could not save task"); }
    };

    const removeTask = async (taskId) => {
        if (!window.confirm("Delete this task?")) return;
        try {
            await api.delete(`/tasks/${taskId}`);
            setTasks((current) => current.filter((task) => task.id !== taskId));
            toast.success("Task deleted");
        } catch (error) { toast.error(error?.response?.data?.detail || "Could not delete task"); }
    };

    const stageTasks = tasks.filter((task) => task.stage_id === stageId);

    return (
        <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Learning content</div>
            <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">Programs, stages & tasks</h1>
            <p className="text-slate-600 mt-1">Create the work students will see from MongoDB.</p>

            <div className="glass rounded-2xl p-5 mt-6">
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Program</label>
                <select value={programId} onChange={(event) => { setProgramId(event.target.value); setStageId(""); setTaskForm(emptyTask); }} className="mt-2 w-full max-w-lg rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-[#0055FF]" data-testid="tasks-program-select">
                    <option value="">Select a program</option>
                    {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
                </select>
            </div>

            <div className="grid lg:grid-cols-3 gap-5 mt-5">
                <div className="glass rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-display text-lg font-semibold">Stages</h2>
                        <span className="text-xs text-slate-500">{stages.length}</span>
                    </div>
                    <div className="space-y-2">
                        {stages.map((stage) => (
                            <button key={stage.id} onClick={() => { setStageId(stage.id); setTaskForm(emptyTask); }} className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${stage.id === stageId ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white/60 hover:bg-slate-50"}`} data-testid={`stage-${stage.id}`}>
                                <span className="text-xs opacity-70">Stage {stage.order}</span>
                                <span className="block font-medium">{stage.name}</span>
                            </button>
                        ))}
                    </div>
                    <div className="border-t border-slate-200 mt-5 pt-5 space-y-3">
                        <input value={stageForm.name} onChange={(event) => setStageForm({ ...stageForm, name: event.target.value })} placeholder="Stage name" className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-[#0055FF]" data-testid="stage-name-input" />
                        <input type="number" min="1" value={stageForm.order} onChange={(event) => setStageForm({ ...stageForm, order: Number(event.target.value) })} placeholder="Order" className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-[#0055FF]" data-testid="stage-order-input" />
                        <button onClick={addStage} disabled={!programId || !stageForm.name.trim()} className="btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-50" data-testid="create-stage-button"><Plus size={14} /> Create stage</button>
                    </div>
                </div>

                <div className="glass rounded-2xl p-5 lg:col-span-2">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-display text-lg font-semibold">Tasks</h2>
                        <span className="text-xs text-slate-500">{stageTasks.length} in selected stage</span>
                    </div>
                    <div className="space-y-2">
                        {stageTasks.map((task) => (
                            <div key={task.id} className="border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-3" data-testid={`task-${task.id}`}>
                                <div className="flex-1 min-w-0"><div className="font-medium text-slate-900">{task.title}</div><div className="text-sm text-slate-500 mt-1">{task.description || "No description"}</div></div>
                                <button onClick={() => setTaskForm(task)} className="p-2 rounded-lg hover:bg-slate-100" title="Edit task" data-testid={`edit-task-${task.id}`}><Pencil size={14} /></button>
                                <button onClick={() => removeTask(task.id)} className="p-2 rounded-lg hover:bg-rose-50 text-rose-600" title="Delete task" data-testid={`delete-task-${task.id}`}><Trash2 size={14} /></button>
                            </div>
                        ))}
                        {stageTasks.length === 0 && <div className="py-8 text-center text-sm text-slate-400">Select a stage or create one to add tasks.</div>}
                    </div>
                    <div className="border-t border-slate-200 mt-5 pt-5 space-y-3">
                        <div className="font-medium text-slate-900">{taskForm.id ? "Edit task" : "Create task"}</div>
                        <input value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} placeholder="Task title" className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-[#0055FF]" data-testid="task-title-input" />
                        <textarea value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} placeholder="Task description" rows={3} className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-[#0055FF] resize-y" data-testid="task-description-input" />
                        <input type="datetime-local" value={taskForm.deadline ? taskForm.deadline.slice(0, 16) : ""} onChange={(event) => setTaskForm({ ...taskForm, deadline: event.target.value ? new Date(event.target.value).toISOString() : null })} className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-[#0055FF]" data-testid="task-deadline-input" />
                        <input type="number" min="1" value={taskForm.order} onChange={(event) => setTaskForm({ ...taskForm, order: Number(event.target.value) })} placeholder="Order" className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-[#0055FF]" data-testid="task-order-input" />
                        <div className="flex gap-2"><button onClick={saveTask} disabled={!stageId || !taskForm.title.trim()} className="btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-50" data-testid="save-task-button"><Plus size={14} /> {taskForm.id ? "Save task" : "Create task"}</button>{taskForm.id && <button onClick={() => setTaskForm(emptyTask)} className="btn-ghost text-sm">Cancel</button>}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TasksAdmin;
