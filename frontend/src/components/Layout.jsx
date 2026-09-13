import React from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";

const Layout = ({ children, showFooter = true, bg = "default" }) => {
    const loc = useLocation();
    return (
        <div className="relative min-h-screen">
            {bg === "hero" && (
                <>
                    <div
                        className="absolute inset-0 -z-10 bg-cover bg-center"
                        style={{
                            backgroundImage:
                                "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.45) 100%), url('https://customer-assets-lqy194kg.emergentagent.net/job_feedback-hub-408/artifacts/1yift54i_landing%20page.jpeg')",
                        }}
                    />
                </>
            )}
            {bg === "default" && (
                <div
                    className="absolute inset-0 -z-10"
                    style={{
                        background:
                            "radial-gradient(900px 500px at 90% -10%, rgba(0,85,255,0.07), transparent 60%), linear-gradient(180deg, #F8FAFC 0%, #F4F7FC 100%)",
                    }}
                />
            )}
            <Navbar />
            <motion.main
                key={loc.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="pt-24"
            >
                {children}
            </motion.main>
            {showFooter && <Footer />}
        </div>
    );
};

export default Layout;
