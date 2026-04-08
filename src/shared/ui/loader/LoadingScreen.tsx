import { motion } from "framer-motion";
import { Activity, X } from "lucide-react";
import { Button } from "../button/Button";

interface LoadingScreenProps {
  onCancel?: () => void;
  message?: string;
}

export function LoadingScreen({ onCancel, message = "Synchronizing Data..." }: LoadingScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-base-100/60 backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.1, opacity: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="relative mb-12"
      >
        {/* Decorative Background Elements */}
        <div className="absolute -inset-24 bg-blue-400/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -inset-16 bg-indigo-400/5 rounded-full blur-2xl animate-pulse delay-700" />

        {/* Pulsing rings */}
        <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping" />
        <div className="absolute -inset-4 rounded-full border border-blue-200/50 animate-[spin_4s_linear_infinite]" />
        <div className="absolute -inset-8 rounded-full border border-blue-100/30 animate-[spin_6s_linear_reverse_infinite]" />

        {/* Main Icon Container */}
        <div className="relative flex items-center justify-center w-20 h-20 bg-base-100 rounded-3xl shadow-2xl shadow-blue-500/10 border border-base-200 transition-transform hover:scale-105 duration-500">
          <Activity className="w-10 h-10 text-blue-600 animate-pulse" />
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="flex flex-col items-center gap-3"
      >
        <h2 className="text-2xl font-black text-base-content tracking-tight">Watchtower</h2>

        <div className="flex items-center gap-1.5 py-1">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" />
        </div>

        <p className="text-xs font-black text-base-content/40 uppercase tracking-[0.2em] mt-2 bg-base-200 px-4 py-1 rounded-full">
          {message}
        </p>

        {onCancel && (
          <Button
            variant="secondary"
            onClick={onCancel}
            className="mt-12 group bg-base-100/40 hover:bg-rose-500/10 border-base-300/50 hover:border-rose-500/30 text-base-content/50 hover:text-rose-600 px-6 py-2 rounded-2xl transition-all duration-300 flex items-center"
          >
            <X className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
            <span className="font-bold text-sm">Cancel Request</span>
          </Button>
        )}
      </motion.div>

      {/* Bottom hint */}
      {!onCancel && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="fixed bottom-12 text-[10px] text-base-content/30 font-bold uppercase tracking-widest"
        >
          Establishing Secure Connection
        </motion.p>
      )}
    </motion.div>
  );
}
