import React from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { Mail, Shield, User } from "lucide-react";

const Profile = () => {
    const { user, logout } = useAuth();
    return (
        <Layout>
            <div className="max-w-3xl mx-auto px-6 pb-24" data-testid="profile-page">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">
                    Account
                </div>
                <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-slate-900">
                    Profile & settings
                </h1>
                <div className="glass rounded-3xl p-8 mt-8 flex items-center gap-6">
                    {user?.picture ? (
                        <img src={user.picture} alt="" className="h-20 w-20 rounded-2xl border border-slate-200" />
                    ) : (
                        <div className="h-20 w-20 rounded-2xl bg-[#0055FF]/10 text-[#0055FF] grid place-items-center font-display text-2xl">
                            {user?.name?.[0]?.toUpperCase()}
                        </div>
                    )}
                    <div>
                        <div className="font-display text-2xl font-medium text-slate-900">
                            {user?.name}
                        </div>
                        <div className="text-slate-600 text-sm inline-flex items-center gap-1.5 mt-1">
                            <Mail size={14} strokeWidth={1.6} /> {user?.email}
                        </div>
                        <div className="text-slate-600 text-sm inline-flex items-center gap-1.5 mt-1">
                            <Shield size={14} strokeWidth={1.6} /> Role: <span className="capitalize font-medium">{user?.role}</span>
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex gap-3">
                    <button onClick={logout} className="btn-primary text-sm" data-testid="profile-logout-btn">
                        Sign out
                    </button>
                </div>
            </div>
        </Layout>
    );
};

export default Profile;
