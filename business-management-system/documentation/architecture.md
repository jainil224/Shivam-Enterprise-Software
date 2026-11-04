# BMS Architecture & Technical Foundation Document

## 1. System Design Goals
- **High Performance on Constrained Hardware:** Specifically targeted for Windows 10 running on AMD E2-9000 CPU with 4 GB RAM.
- **Zero Third-Party Cost:** No paid cloud services, no Docker containers, purely native Windows processes.
- **Modularity:** Isolated frontend (`/frontend`) and backend (`/backend`) connected strictly via REST API.
- **Data Integrity:** Strict multi-company and multi-financial-year isolation on every transaction.

## 2. Component Architecture

```
┌────────────────────────────────────────────────────────┐
│                   React 18 SPA (Vite)                  │
│   Tailwind CSS • Lucide Icons • Axios API Client       │
│                  Port: 5173 (LAN Open)                 │
└───────────────────────────┬────────────────────────────┘
                            │ REST API (JSON)
                            ▼
┌────────────────────────────────────────────────────────┐
│                Express.js Server (TypeScript)          │
│   Health Controller • Error Middleware • CORS          │
│                  Port: 5000 (LAN Open)                 │
└───────────────────────────┬────────────────────────────┘
                            │ Prisma Client
                            ▼
┌────────────────────────────────────────────────────────┐
│               PostgreSQL Database (Local)              │
│            Database: business_management               │
│                  Port: 5432 (Localhost)                │
└────────────────────────────────────────────────────────┘
```

## 3. Multi-Company & Financial Year Principle
Every operational entity in future phases will enforce:
- `company_id` (UUID foreign key)
- `financial_year_id` (UUID foreign key)
- Composite index on `(company_id, financial_year_id)` for lightning-fast lookups on low-RAM hardware.

## 4. API Specification for Phase 1
- `GET /api/health`: Returns server status, uptime, environment, and version.
- `GET /api/health/db`: Executes `SELECT 1` via Prisma to verify PostgreSQL connectivity without exposing credentials or crashing the server if offline.

