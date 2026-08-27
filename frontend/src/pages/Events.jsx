import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { Calendar, Clock, MapPin, User, Lock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const statusOf = (ev) => {
    const now = new Date();
    const s = new Date(ev.starts_at);
    const e = new Date(ev.ends_at);
    if (now < s) return "upcoming";
    if (now > e) return "completed";
    return "ongoing";
};

const badgeClass = (st) => ({
    upcoming: "bg-slate-900/5 text-slate-700",
    ongoing: "bg-emerald-500/15 text-emerald-700",
    completed: "bg-amber-500/15 text-amber-700",
}[st]);

const countdown = (dt) => {
    const diff = new Date(dt) - new Date();
    if (diff <= 0) return null;
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${d}d ${h}h ${m}m`;
};

const Events = () => {
    const [events, setEvents] = useState([]);
    const [pending, setPending] = useState([]);
    const nav = useNavigate();

    useEffect(() => {
        api.get("/events").then((r) => setEvents(r.data));
        api.get("/feedback/pending-events").then((r) => setPending(r.data));
    }, []);

    const pendingIds = new Set(pending.map((p) => p.id));

    return (
        <Layout>
            <div className="max-w-7xl mx-auto px-6 pb-20" data-testid="events-page">
                <div className="mb-10">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">
                        Seminars · Workshops · Activities
                    </div>
                    <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">
                        Events at KLECBA
                    </h1>
                    <p className="text-slate-600 mt-2 max-w-xl">
                        Feedback unlocks automatically when an event finishes.
                    </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                    {events.map((ev, i) => {
                        const st = statusOf(ev);
                        const canFeedback = st === "completed" && pendingIds.has(ev.id);
                        return (
                            <motion.div
                                key={ev.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="glass rounded-2xl p-6 card-lift"
                                data-testid={`event-card-${ev.id}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="font-display text-lg font-semibold text-slate-900">
                                            {ev.title}
                                        </div>
                                        <div className="text-sm text-slate-600 mt-1 line-clamp-2">
                                            {ev.description}
                                        </div>
                                    </div>
                                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${badgeClass(st)}`}>
                                        {st}
                                    </span>
                                </div>

                                <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-600">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} strokeWidth={1.6} />
                                        {new Date(ev.starts_at).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock size={14} strokeWidth={1.6} />
                                        {new Date(ev.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin size={14} strokeWidth={1.6} />
                                        {ev.venue || "TBD"}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <User size={14} strokeWidth={1.6} />
                                        {ev.speaker || "TBD"}
                                    </div>
                                </div>

                                <div className="mt-5 flex items-center justify-between">
                                    {st === "upcoming" && (
                                        <div className="text-xs text-slate-500">
                                            Starts in {countdown(ev.starts_at) || "soon"}
                                        </div>
                                    )}
                                    {st === "ongoing" && (
                                        <div className="text-xs text-emerald-700">Happening now</div>
                                    )}
                                    {st === "completed" && !canFeedback && (
                                        <div className="text-xs text-slate-500 inline-flex items-center gap-1">
                                            <Lock size={12} /> Feedback submitted
                                        </div>
                                    )}
                                    {canFeedback ? (
                                        <button
                                            onClick={() => nav(`/feedback/${ev.feedback_type}?event=${ev.id}`)}
                                            className="btn-primary text-sm inline-flex items-center gap-1.5"
                                            data-testid={`event-feedback-btn-${ev.id}`}
                                        >
                                            Give feedback
                                            <ArrowRight size={14} strokeWidth={1.8} />
                                        </button>
                                    ) : (
                                        <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                                            <Lock size={12} strokeWidth={1.6} /> {st === "completed" ? "" : "Feedback locked"}
                                        </span>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {events.length === 0 && (
                    <div className="glass rounded-2xl p-10 text-center text-slate-500 text-sm">
                        No events scheduled yet.
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Events;
