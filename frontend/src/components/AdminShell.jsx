import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
    LayoutDashboard, GraduationCap, Users, School, ClipboardList,
    CalendarDays, FileText, MessageSquare, LineChart, LogOut, Menu, X, Bell,
} from "lucide-react";
import { motion } from "framer-motion";

const items = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/admin/academic", label: "Academic Structure", icon: School },
    { to: "/admin/faculty", label: "Faculty & Assignments", icon: Users },
    { to: "/admin/students", label: "Students", icon: GraduationCap },
    { to: "/admin/templates", label: "Feedback Templates", icon: FileText },
    { to: "/admin/cycles", label: "Feedback Cycles", icon: ClipboardList },
    { to: "/admin/responses", label: "Responses", icon: MessageSquare },
    { to: "/admin/insights", label: "Question Insights", icon: LineChart },
    { to: "/admin/events", label: "Events", icon: CalendarDays },
];

const AdminShell = () => {
    const { user, logout } = useAuth();
    const nav = useNavigate();
    const loc = useLocation();
    const [openMobile, setOpenMobile] = useState(false);

    useEffect(() => setOpenMobile(false), [loc.pathname]);

    return (
        <div className="min-h-screen">
            <div
                className="absolute inset-0 -z-10"
                style={{ background: "radial-gradient(900px 500px at 90% -10%, rgba(0,85,255,0.07), transparent 60%), linear-gradient(180deg, #F8FAFC 0%, #F4F7FC 100%)" }}
            />
            {/* Sidebar */}
            <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-72 z-40 border-r border-slate-200/70 bg-white/70 backdrop-blur-xl flex-col">
                <div className="px-6 py-6 border-b border-slate-200/70">
                    <div className="flex items-center gap-2.5">
                        <span className="h-9 w-9 rounded-xl bg-[#0A1128] text-white grid place-items-center">
                            <GraduationCap size={18} strokeWidth={1.6} />
                        </span>
                        <div className="leading-tight">
                            <div className="font-display text-[15px] font-semibold text-slate-900">KLECBA</div>
                            <div className="text-[11px] text-slate-500 -mt-0.5">Admin Console</div>
                        </div>
                    </div>
                </div>
                <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                    {items.map((it) => (
                        <NavLink
                            key={it.to}
                            to={it.to}
                            end={it.end}
                            data-testid={`side-${it.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                                    isActive
                                        ? "bg-slate-900 text-white"
                                        : "text-slate-700 hover:bg-slate-900/5"
                                }`
                            }
                        >
                            <it.icon size={16} strokeWidth={1.6} /> {it.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="border-t border-slate-200/70 p-3">
                    <div className="flex items-center gap-3 px-2 py-2">
                        <div className="h-8 w-8 rounded-full bg-[#0055FF]/10 text-[#0055FF] grid place-items-center text-xs font-semibold">
                            {user?.name?.[0]?.toUpperCase() || "A"}
                        </div>
                        <div className="leading-tight flex-1 min-w-0">
                            <div className="text-[13px] font-medium text-slate-900 truncate">{user?.name}</div>
                            <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
                        </div>
                        <button onClick={logout} className="p-2 rounded-lg hover:bg-slate-900/5" data-testid="admin-logout-btn">
                            <LogOut size={14} strokeWidth={1.6} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile top bar */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-40 glass border-b border-slate-200/60 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => setOpenMobile((v) => !v)} className="h-10 w-10 grid place-items-center rounded-full bg-slate-900/5" data-testid="admin-mobile-menu">
                        {openMobile ? <X size={18} /> : <Menu size={18} />}
                    </button>
                    <div className="font-display font-semibold text-slate-900">KLECBA Admin</div>
                </div>
                <button onClick={logout} className="btn-ghost text-sm inline-flex items-center gap-1.5">
                    <LogOut size={14} /> Sign out
                </button>
            </div>
            {openMobile && (
                <div className="lg:hidden fixed top-16 left-0 right-0 z-40 glass border-b border-slate-200/60 p-3 space-y-1">
                    {items.map((it) => (
                        <NavLink
                            key={it.to} to={it.to} end={it.end}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-900/5"}`
                            }
                        >
                            <it.icon size={16} strokeWidth={1.6} /> {it.label}
                        </NavLink>
                    ))}
                </div>
            )}

            <motion.main
                key={loc.pathname}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}
                className="lg:ml-72 pt-20 lg:pt-8 px-5 md:px-10 pb-16"
            >
                <Outlet />
            </motion.main>
        </div>
    );
};

export default AdminShell;
