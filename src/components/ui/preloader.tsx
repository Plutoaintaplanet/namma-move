import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export function Preloader({ onComplete }: { onComplete: () => void }) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Show the logo animation for 2 seconds, then trigger exit
        const timer = setTimeout(() => {
            setIsVisible(false);
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <AnimatePresence onExitComplete={onComplete}>
            {isVisible && (
                <motion.div
                    className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
                    style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, filter: "blur(12px)", scale: 1.05 }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                >
                    <motion.img
                        src="/logo.png"
                        alt="Namma Move"
                        className="w-32 h-32 md:w-48 md:h-48 object-contain mb-8 drop-shadow-2xl"
                        initial={{ scale: 0.1, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        transition={{
                            duration: 1.2,
                            ease: [0.22, 1, 0.36, 1],
                            opacity: { duration: 0.8 }
                        }}
                    />
                    <motion.h1
                        className="text-4xl md:text-6xl font-black tracking-tighter"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{
                            delay: 0.3,
                            duration: 0.9,
                            ease: [0.22, 1, 0.36, 1]
                        }}
                    >
                        Namma Move
                    </motion.h1>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
