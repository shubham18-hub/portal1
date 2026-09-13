import React from "react";
import { GraduationCap } from "lucide-react";

const Footer = () => {
    return (
        <footer
            className="relative border-t border-slate-200/70 mt-24"
            data-testid="footer"
        >
            <div className="max-w-7xl mx-auto px-6 py-14 grid gap-10 md:grid-cols-4">
                <div className="md:col-span-2">
                    <div className="flex items-center gap-2.5 mb-4">
                        <span className="h-9 w-9 rounded-xl bg-[#0A1128] text-white grid place-items-center">
                            <GraduationCap size={18} strokeWidth={1.6} />
                        </span>
                        <div>
                            <div className="font-display font-semibold text-slate-900">
                                KLECBA
                            </div>
                            <div className="text-xs text-slate-500 -mt-0.5">
                                KLE College of Business Administration, Hubli
                            </div>
                        </div>
                    </div>
                    <p className="text-sm text-slate-500 max-w-md leading-relaxed">
                        A premium feedback experience for students, faculty,
                        and administrators — built to elevate teaching quality
                        and institutional excellence.
                    </p>
                </div>
                <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">
                        Portal
                    </div>
                    <ul className="space-y-2 text-sm text-slate-700">
                        <li>Student Feedback</li>
                        <li>Certification Courses</li>
                        <li>Faculty Reviews</li>
                        <li>Academic Experience</li>
                    </ul>
                </div>
                <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">
                        Institution
                    </div>
                    <ul className="space-y-2 text-sm text-slate-700">
                        <li>About KLECBA</li>
                        <li>Departments</li>
                        <li>Events</li>
                        <li>Contact</li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-slate-200/70">
                <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                        © {new Date().getFullYear()} KLECBA · Hubli. All
                        rights reserved.
                    </p>
                    <p className="text-xs text-slate-500">
                        Crafted with precision · Institutional-grade quality
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
