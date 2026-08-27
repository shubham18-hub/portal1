import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import AdminLogin from "@/pages/AdminLogin";
import AuthCallback from "@/pages/AuthCallback";
import StudentDashboard from "@/pages/StudentDashboard";
import FeedbackWizard from "@/pages/FeedbackWizard";
import Events from "@/pages/Events";
import Profile from "@/pages/Profile";
import ProtectedRoute from "@/components/ProtectedRoute";

import AdminShell from "@/components/AdminShell";
import AdminHome from "@/pages/admin/AdminHome";
import AcademicStructure from "@/pages/admin/AcademicStructure";
import FacultyAdmin from "@/pages/admin/FacultyAdmin";
import StudentsAdmin from "@/pages/admin/StudentsAdmin";
import TemplatesAdmin from "@/pages/admin/TemplatesAdmin";
import CyclesAdmin from "@/pages/admin/CyclesAdmin";
import ResponsesAdmin from "@/pages/admin/ResponsesAdmin";
import EventsAdmin from "@/pages/admin/EventsAdmin";
import QuestionInsights from "@/pages/admin/QuestionInsights";
import RemindersAdmin from "@/pages/admin/RemindersAdmin";
import FacultyPortal from "@/pages/FacultyPortal";

function RoleRedirect() {
    const { user } = useAuth();
    if (!user) return null;
    if (user.role === "admin") return <Navigate to="/admin" replace />;
    if (user.role === "faculty") return <Navigate to="/faculty" replace />;
    return <StudentDashboard />;
}


function AppRouter() {
    const location = useLocation();
    if (location.hash?.includes("session_id=")) {
        return <AuthCallback />;
    }
    return (
        <Routes>            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            <Route path="/dashboard" element={<ProtectedRoute><RoleRedirect /></ProtectedRoute>} />
            <Route path="/faculty" element={<ProtectedRoute roles={["faculty"]}><FacultyPortal /></ProtectedRoute>} />
            <Route path="/feedback/cycle/:cycleId" element={<ProtectedRoute roles={["student"]}><FeedbackWizard /></ProtectedRoute>} />
            <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

            <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminShell /></ProtectedRoute>}>
                <Route index element={<AdminHome />} />
                <Route path="academic" element={<AcademicStructure />} />
                <Route path="faculty" element={<FacultyAdmin />} />
                <Route path="students" element={<StudentsAdmin />} />
                <Route path="templates" element={<TemplatesAdmin />} />
                <Route path="cycles" element={<CyclesAdmin />} />
                <Route path="responses" element={<ResponsesAdmin />} />
                <Route path="insights" element={<QuestionInsights />} />
                <Route path="reminders" element={<RemindersAdmin />} />
                <Route path="events" element={<EventsAdmin />} />
                <Route path="analytics" element={<AdminHome />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <div className="App">
            <BrowserRouter>
                <AuthProvider>
                    <AppRouter />
                    <Toaster position="top-center" richColors />
                </AuthProvider>
            </BrowserRouter>
        </div>
    );
}

export default App;
