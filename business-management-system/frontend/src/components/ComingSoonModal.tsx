import React from 'react';
import { X, Sparkles, Clock, ShieldCheck } from 'lucide-react';

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  plannedPhase: string;
  description: string;
}

export const ComingSoonModal: React.FC<ComingSoonModalProps> = ({
  isOpen,
  onClose,
  title,
  plannedPhase,
  description,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">{title}</h2>
              <p className="text-xs text-blue-300 font-mono">{plannedPhase}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/60">
            <div className="flex items-start space-x-3">
              <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Module Scheduled in Roadmap</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {description}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Architectural Status</span>
            </div>
            <ul className="space-y-1.5 pl-5 list-disc text-slate-500">
              <li>
                <strong className="text-slate-700">Database Layer:</strong> PostgreSQL models, foreign keys, and 3-decimal precision weight fields are already compiled and active.
              </li>
              <li>
                <strong className="text-slate-700">Company Isolation:</strong> All future transactions will be restricted strictly to your active company and fiscal year context.
              </li>
              <li>
                <strong className="text-slate-700">Planned Implementation:</strong> This module interface and print layouts will be activated in accordance with project phase sequence.
              </li>
            </ul>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="text-[11px] text-slate-400">
              Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono">Esc</kbd> to close
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
            >
              Acknowledge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
