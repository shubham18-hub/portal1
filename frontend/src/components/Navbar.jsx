import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { GraduationCap, LogOut, Menu, X } from "lucide-react";

const navFor = (role) => {
    if (role === "admin")
        return [{ label: "Dashboard", to: "/admin" }, { label: "Profile", to: "/profile" }];
    if (role === "faculty")
        return [{ label: "Events", to: "/events" }, { label: "Profile", to: "/profile" }];
    return [
        { label: "Dashboard", to: "/dashboard" },
        { label: "Events", to: "/events" },
        { label: "Profile", to: "/profile" },
    ];
};

const Navbar = () => {
    const { user, logout } = useAuth();
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);
    const loc = useLocation();
    const nav = useNavigate();

    useEffect(() => {
        const on = () => setScrolled(window.scrollY > 8);
        on();
        window.addEventListener("scroll", on);
        return () => window.removeEventListener("scroll", on);
    }, []);
    useEffect(() => setOpen(false), [loc.pathname]);

    const links = user ? navFor(user.role) : [];

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-[background,border,box-shadow] duration-300 ${
                scrolled
                    ? "glass border-b border-slate-200/60"
                    : "bg-transparent border-b border-transparent"
            }`}
            data-testid="navbar"
        >
            <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
                <Link
                    to={user ? (user.role === "admin" ? "/admin" : "/dashboard") : "/"}
                    className="flex items-center gap-2.5 group"
                    data-testid="navbar-brand"
                >
                    <span className="h-9 w-9 rounded-xl bg-[#0A1128] text-white grid place-items-center shadow-sm">
                        <GraduationCap size={18} strokeWidth={1.6} />
                    </span>
                    <div className="leading-tight">
                        <div className="font-display text-[15px] font-semibold text-slate-900">
                            KLECBA
                        </div>
                        <div className="text-[11px] text-slate-500 -mt-0.5">
                            Feedback Portal
                        </div>
                    </div>
                </Link>

                <nav className="hidden md:flex items-center gap-1">
                    {links.map((l) => (
                        <Link
                            key={l.to}
                            to={l.to}
                            data-testid={`nav-${l.label.toLowerCase()}`}
                            className={`px-3.5 py-2 rounded-full text-sm transition-colors ${
                                loc.pathname === l.to
                                    ? "bg-slate-900 text-white"
                                    : "text-slate-700 hover:bg-slate-900/5"
                            }`}
                        >
                            {l.label}
                        </Link>
                    ))}
                </nav>

                <div className="hidden md:flex items-center gap-3">
                    {user ? (
                        <>
                            <div className="flex items-center gap-2.5 pr-1">
                                {user.picture ? (
                                    <img
                                        src={user.picture}
                                        alt=""
                                        className="h-8 w-8 rounded-full border border-slate-200"
                                    />
                                ) : (
                                    <div className="h-8 w-8 rounded-full bg-[#0055FF]/10 text-[#0055FF] grid place-items-center text-xs font-semibold">
                                        {user.name?.[0]?.toUpperCase() || "U"}
                                    </div>
                                )}
                                <div className="text-right leading-tight">
                                    <div className="text-[13px] font-medium text-slate-900">
                                        {user.name}
                                    </div>
                                    <div className="text-[11px] uppercase tracking-widest text-slate-500">
                                        {user.role}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={logout}
                                data-testid="logout-btn"
                                className="btn-ghost text-sm inline-flex items-center gap-1.5"
                            >
                                <LogOut size={15} strokeWidth={1.6} /> Sign out
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => nav("/login")}
                            className="btn-primary text-sm"
                            data-testid="navbar-login-btn"
                        >
                            Sign in
                        </button>
                    )}
                </div>

                <button
                    onClick={() => setOpen((v) => !v)}
                    className="md:hidden h-10 w-10 grid place-items-center rounded-full bg-slate-900/5"
                    data-testid="mobile-menu-toggle"
                    aria-label="Menu"
                >
                    {open ? <X size={18} /> : <Menu size={18} />}
                </button>
            </div>

            {open && (
                <div className="md:hidden glass border-t border-slate-200/60 px-6 py-4 space-y-1">
                    {user ? (
                        <>
                            {links.map((l) => (
                                <Link
                                    key={l.to}
                                    to={l.to}
                                    className="block px-3 py-2.5 rounded-xl text-sm hover:bg-slate-900/5"
                                    data-testid={`mnav-${l.label.toLowerCase()}`}
                                >
                                    {l.label}
                                </Link>
                            ))}
                            <button
                                onClick={logout}
                                className="w-full text-left px-3 py-2.5 rounded-xl text-sm hover:bg-slate-900/5"
                                data-testid="mobile-logout-btn"
                            >
                                Sign out
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => nav("/login")}
                            className="btn-primary w-full text-sm"
                            data-testid="mobile-login-btn"
                        >
                            Sign in
                        </button>
                    )}
                </div>
            )}
        </header>
    );
};

export default Navbar;
