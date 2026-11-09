import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { MenuItem } from '../config/navigation';

interface ReportMenuPanelProps {
  items: MenuItem[];
  onSelect: (item: MenuItem) => void;
}

interface ReportMenuLevelProps {
  items: MenuItem[];
  onSelect: (item: MenuItem) => void;
  root?: boolean;
}

const ReportMenuLevel: React.FC<ReportMenuLevelProps> = ({ items, onSelect, root }) => {
  const [openTitle, setOpenTitle] = useState<string | null>(null);

  return (
    <div
      className={
        root
          ? 'py-0.5'
          : 'absolute left-full top-0 ml-0.5 w-60 bg-white rounded-lg shadow-xl border border-slate-200 py-1 text-slate-800 z-50 text-xs animate-in fade-in duration-75'
      }
    >
      {!root && (
        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
          Select Report
        </div>
      )}
      {items.map((item) => {
        const hasChildren = Boolean(item.children && item.children.length > 0);
        const badge = item.implemented ? 'Active' : item.plannedPhase ?? 'Planned';
        return (
          <div
            key={item.title}
            className="relative"
            onMouseEnter={() => {
              if (hasChildren) setOpenTitle(item.title);
            }}
            onMouseLeave={() => {
              if (hasChildren) setOpenTitle(null);
            }}
          >
            <button
              type="button"
              title={item.description ?? item.title}
              onClick={() => {
                if (hasChildren) {
                  setOpenTitle(openTitle === item.title ? null : item.title);
                  return;
                }
                onSelect(item);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between gap-2 text-slate-700 hover:text-blue-600"
            >
              <span className={item.implemented ? 'font-bold text-[#2c5f57]' : ''}>{item.title}</span>
              {hasChildren ? (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              ) : (
                <span
                  className={
                    'text-[10px] font-mono shrink-0 px-1 rounded border ' +
                    (item.implemented
                      ? 'text-emerald-700 font-bold bg-emerald-50 border-emerald-200'
                      : 'text-slate-400 border-transparent')
                  }
                >
                  {badge}
                </span>
              )}
            </button>

            {hasChildren && openTitle === item.title && (
              <ReportMenuLevel items={item.children ?? []} onSelect={onSelect} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export const ReportMenuPanel: React.FC<ReportMenuPanelProps> = ({ items, onSelect }) => (
  <ReportMenuLevel items={items} onSelect={onSelect} root />
);

export default ReportMenuPanel;
