import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Server, 
  Database, 
  LayoutDashboard, 
  RefreshCw,
  Cpu,
  Clock,
  Building2,
  Calendar,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { checkServerHealth, checkDbHealth } from '../services/api';
import { HealthStatus, DbHealthStatus } from '../types';
import { useCompany } from '../context/CompanyContext';

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCompany, activeFinancialYear } = useCompany();

  const [frontendStatus] = useState<'running'>('running');
  
  const [serverHealth, setServerHealth] = useState<HealthStatus | null>(null);
  const [serverLoading, setServerLoading] = useState<boolean>(true);
  const [serverError, setServerError] = useState<string | null>(null);

  const [dbHealth, setDbHealth] = useState<DbHealthStatus | null>(null);
  const [dbLoading, setDbLoading] = useState<boolean>(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const fetchStatus = async () => {
    setServerLoading(true);
    setDbLoading(true);
    setServerError(null);
    setDbError(null);

    // 1. Check Backend Server Health
    try {
      const sData = await checkServerHealth();
      setServerHealth(sData);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Backend unreachable on port 5000';
      setServerError(errorMsg);
      setServerHealth(null);
    } finally {
      setServerLoading(false);
    }

    // 2. Check Database Health via Backend
    try {
      const dbData = await checkDbHealth();
      setDbHealth(dbData);
      if (dbData.status !== 'connected') {
        setDbError(dbData.message);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Database health check failed';
      setDbError(errorMsg);
      setDbHealth(null);
    } finally {
      setDbLoading(false);
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="w-full space-y-8">
      {/* Active Company Banner / Selection Prompt */}
      {activeCompany && activeFinancialYear ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-xs">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded">
                  Active Working Context
                </span>
                <span className="font-mono text-xs font-bold text-slate-700 bg-white border border-emerald-200 px-1.5 py-0.5 rounded">
                  {activeCompany.companyCode}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">{activeCompany.companyName}</h2>
              <p className="text-xs text-slate-600 flex items-center space-x-2 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-700 inline" />
                <span>Financial Year: <strong className="font-mono">{activeFinancialYear.yearName}</strong></span>
                {activeFinancialYear.isLocked && (
                  <span className="text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-semibold text-[10px]">
                    Locked
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/companies')}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0"
          >
            <span>Change Company</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-amber-500 text-white rounded-xl shadow-xs">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider bg-amber-100 px-2 py-0.5 rounded">
                Company Required
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-1">
                No active company is currently selected
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Select an existing enterprise or register a new company and financial year to get started.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/companies')}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors shrink-0"
          >
            <span>Select / Add Company</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hero Welcome Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <span className="text-xs font-semibold tracking-wider text-blue-600 uppercase bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              Phase 3 • Company Management
            </span>
            <h1 className="text-3xl font-extrabold text-slate-900 mt-2">
              Business Management System
            </h1>
            <p className="text-slate-600 mt-1">
              High-performance, resource-optimized on-premises software engineered for Shivam Enterprise.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/companies')}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm"
            >
              <Building2 className="w-4 h-4" />
              <span>Company Manager</span>
            </button>
            <button
              onClick={fetchStatus}
              disabled={serverLoading || dbLoading}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${(serverLoading || dbLoading) ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        {/* Highlighted Banner */}
        <div className="mt-6 p-4 rounded-xl bg-blue-50/70 border border-blue-200/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div className="text-sm font-semibold text-slate-800">
              Project Status: <span className="text-blue-700 font-bold">Phase 3 Ready • Local Architecture Active</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Checked: {lastChecked.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Real Live Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Frontend Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Active
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Frontend Status</h3>
              <p className="text-xs text-slate-500 mt-1">React 18 + Vite + Tailwind CSS</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Status:</span>
              <span className="font-semibold text-emerald-600 capitalize">{frontendStatus}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Port:</span>
              <span className="font-mono text-slate-700">5173</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Environment:</span>
              <span className="font-mono text-slate-700">Development</span>
            </div>
          </div>
        </div>

        {/* Card 2: Backend API Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Server className="w-5 h-5" />
              </div>
              {serverLoading ? (
                <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Probing
                </span>
              ) : serverHealth?.status === 'ok' ? (
                <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Online
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Offline
                </span>
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Backend API Status</h3>
              <p className="text-xs text-slate-500 mt-1">Node.js + Express + TypeScript</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Endpoint:</span>
              <span className="font-mono text-slate-700">GET /api/health</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Server Status:</span>
              <span className={`font-semibold ${serverHealth?.status === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {serverHealth ? serverHealth.status.toUpperCase() : (serverError ? 'OFFLINE' : 'CHECKING')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Uptime:</span>
              <span className="font-mono text-slate-700">
                {serverHealth?.uptime ? `${Math.floor(serverHealth.uptime)}s` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: PostgreSQL Database Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                <Database className="w-5 h-5" />
              </div>
              {dbLoading ? (
                <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Probing
                </span>
              ) : dbHealth?.status === 'connected' ? (
                <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Not Connected
                </span>
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">PostgreSQL Status</h3>
              <p className="text-xs text-slate-500 mt-1">Prisma ORM • business_management</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Endpoint:</span>
              <span className="font-mono text-slate-700">GET /api/health/db</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Connection:</span>
              <span className={`font-semibold ${dbHealth?.status === 'connected' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {dbHealth ? dbHealth.status.toUpperCase() : 'PENDING'}
              </span>
            </div>
            <div className="flex justify-between truncate">
              <span className="text-slate-400">Latency:</span>
              <span className="font-mono text-slate-700">
                {dbHealth?.latencyMs !== undefined ? `${dbHealth.latencyMs} ms` : 'N/A'}
              </span>
            </div>
            {dbError && (
              <div className="mt-1 text-[11px] text-amber-700 bg-amber-50 rounded p-1.5 border border-amber-200/50 break-words">
                {dbError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hardware Profile & Architecture Details */}
      <div className="bg-slate-100/80 rounded-xl p-5 border border-slate-200/80 flex items-start space-x-4">
        <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 shrink-0">
          <Cpu className="w-5 h-5" />
        </div>
        <div className="text-xs text-slate-600 space-y-1">
          <div className="font-semibold text-slate-800 text-sm">Low-Footprint Hardware Optimization Active</div>
          <p>
            Engineered specifically for your laptop (AMD E2-9000 • 4 GB RAM). Lean Vite bundling, fast tsx server execution, zero containerization overhead, and lightweight JSON transactions.
          </p>
        </div>
      </div>
    </div>
  );
};
