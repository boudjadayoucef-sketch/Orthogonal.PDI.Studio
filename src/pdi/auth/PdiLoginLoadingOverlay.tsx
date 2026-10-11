import React, { useEffect, useState } from "react";
import { ShieldCheck, Cpu, Box, CheckCircle2, Lock, Loader2, Sparkles, Activity } from "lucide-react";

interface PdiLoginLoadingOverlayProps {
  userEmail?: string;
  userName?: string;
  onFinished?: () => void;
  message?: string;
}

export const PdiLoginLoadingOverlay: React.FC<PdiLoginLoadingOverlayProps> = ({
  userEmail,
  userName,
  message,
}) => {
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setStep(2);
      setProgress(45);
    }, 400);

    const timer2 = setTimeout(() => {
      setStep(3);
      setProgress(80);
    }, 900);

    const timer3 = setTimeout(() => {
      setStep(4);
      setProgress(100);
    }, 1400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const steps = [
    { num: 1, label: "Vérification des identifiants & chiffrement SSL/TLS", icon: Lock },
    { num: 2, label: "Validation de la licence et droits d'accès PD&I", icon: ShieldCheck },
    { num: 3, label: "Initialisation du Moteur Isométrique & Spooling 3D", icon: Cpu },
    { num: 4, label: "Connexion établie — Ouverture de l'espace de travail", icon: CheckCircle2 },
  ];

  return (
    <div className="fixed inset-0 z-[999999] bg-[#03060d]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-white font-sans select-none animate-fadeIn">
      {/* Background Cyber Glowing Orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-cyan-500/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative z-10 max-w-md w-full bg-[#080d1a]/90 border border-orange-500/30 rounded-3xl p-8 shadow-2xl shadow-orange-500/10 backdrop-blur-md flex flex-col items-center text-center">
        {/* Animated Central Scanner / Spinner */}
        <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
          {/* Outer Rotating Ring */}
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-orange-500/40 animate-[spin_8s_linear_infinite]" />
          <div className="absolute inset-2 rounded-full border-2 border-t-cyan-400 border-r-transparent border-b-orange-500 border-l-transparent animate-spin" />
          
          {/* Core Pulsing Icon */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-cyan-500/20 border border-white/10 shadow-inner">
            <Box className="w-9 h-9 text-orange-400 animate-pulse" />
          </div>
        </div>

        {/* Title & User Greeting */}
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-orange-400 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-orange-400">
            PD&I • System Authenticator
          </span>
        </div>

        <h3 className="text-xl font-extrabold text-white mb-1">
          {message || "Connexion en cours..."}
        </h3>

        {(userName || userEmail) && (
          <p className="text-xs font-mono text-slate-400 mb-6 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800">
            {userName ? `${userName} (${userEmail || ''})` : userEmail}
          </p>
        )}

        {/* Animated Progress Bar */}
        <div className="w-full bg-slate-900/90 rounded-full h-2.5 mb-6 overflow-hidden border border-slate-800 p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-cyan-400 transition-all duration-500 shadow-lg shadow-orange-500/50"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Dynamic Verification Steps */}
        <div className="w-full flex flex-col gap-2.5 text-left text-xs mb-2">
          {steps.map((st) => {
            const Icon = st.icon;
            const isDone = step > st.num || (step === 4 && st.num === 4);
            const isCurrent = step === st.num;

            return (
              <div
                key={st.num}
                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                  isDone
                    ? "bg-slate-900/60 border-green-500/30 text-slate-200"
                    : isCurrent
                    ? "bg-orange-500/10 border-orange-500/40 text-orange-300 shadow-sm"
                    : "bg-slate-950/40 border-slate-800/60 text-slate-600"
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${
                    isDone
                      ? "bg-green-500/20 text-green-400"
                      : isCurrent
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-slate-900 text-slate-700"
                  }`}
                >
                  {isCurrent ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isDone ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span className={`font-medium text-[11px] leading-snug ${isCurrent ? "font-bold" : ""}`}>
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer Subtext */}
        <div className="mt-4 flex items-center justify-between w-full text-[10px] text-slate-500 border-t border-slate-800/80 pt-3">
          <span className="flex items-center gap-1 font-mono">
            <Activity className="w-3 h-3 text-cyan-400" /> API Session: 256-bit AES
          </span>
          <span className="font-mono text-orange-400 font-bold">{progress}%</span>
        </div>
      </div>
    </div>
  );
};
