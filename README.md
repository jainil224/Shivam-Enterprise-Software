# Business Management System (BMS) - Sivam Enterprise

> **High-Performance, Resource-Optimized On-Premises Business Management System**
> Engineered specifically for Windows 10 (AMD E2-9000, 4 GB RAM) with a modular architecture for future scalability across LAN and remote environments.

---

## 1. Project Overview

The **Business Management System (BMS)** is a custom, private enterprise application designed to replace legacy desktop systems. It provides a modern, fast, and unified platform for:
- Multi-company management
- Financial year administration
- Master data management (Parties, Qualities, Shades, Godowns)
- Manufacturing and Production Receive entries
- Dynamic Carton and Yarn weight calculations
- Thermal / A4 Production Challan printing & PDF exports
- Future modules: Sales, Purchases, GST, Inventory, and Accounting

---

## 2. Technology Stack

### Frontend
- **Framework:** React 18
- **Language:** TypeScript
- **Build Tool:** Vite (Ultra-fast, lightweight ES modules)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Routing:** React Router v6
- **HTTP Client:** Axios (Modular, timeout-protected)

### Backend
- **Runtime:** Node.js 24 LTS
- **Framework:** Express.js
- **Language:** TypeScript
- **Execution:** `tsx` (Zero-config, low-memory TypeScript runner)
- **ORM:** Prisma ORM
- **Architecture:** Controller-Service-Repository pattern

### Database & Infrastructure
- **Database:** PostgreSQL (Local on-premises instance)
- **Database Name:** `business_management`
- **Network Deployment:** Windows Laptop Host (LAN / Office Wi-Fi accessible)
- **Zero Third-Party Cost:** No paid cloud databases, no Docker bloat, no subscription services.

---

## 3. Hardware Profile & Resource Strategy

This system is tuned for low-resource environments (**AMD E2-9000, 4 GB RAM**):
- **No Docker:** Direct process execution on Windows eliminates container overhead.
- **Minimal Dependencies:** Strict dependency pruning.
- **Single Backend & Frontend Processes:** Managed via clean npm commands.
- **Connection Pooling & Non-Blocking Queries:** Handled via Prisma and async Express handlers.

---

## 4. Prerequisites

Before running the application, ensure the following software is installed on Windows:

| Component | Minimum Version | Verification Command | Official Download Link |
|---|---|---|---|
| **Node.js** | v20.x or v24.x | `node -v` | [nodejs.org](https://nodejs.org/en/download/) |
| **npm** | v10.x or v11.x | `npm -v` | Included with Node.js |
| **Git** | v2.4x+ | `git --version` | [git-scm.com](https://git-scm.com/download/win) |
| **PostgreSQL** | v15.x or v16.x | `psql --version` | [postgresql.org](https://www.postgresql.org/download/windows/) |

---

## 5. Directory Structure

```text
business-management-system/
├── frontend/
│   ├── src/
│   │   ├── assets/          # Static assets & logos
│   │   ├── components/      # Reusable UI components
│   │   ├── layouts/         # Layout wrappers (RootLayout, Sidebar)
│   │   ├── pages/           # View pages (WelcomePage, etc.)
│   │   ├── services/        # Axios API client & endpoints
│   │   ├── hooks/           # Custom React hooks
│   │   ├── types/           # TypeScript interfaces & types
│   │   ├── styles/          # Tailwind CSS global stylesheet
│   │   ├── App.tsx          # Main React router
│   │   └── main.tsx         # React DOM entry point
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── config/          # Environment configuration (env.ts)
│   │   ├── controllers/     # Route controllers (healthController.ts)
│   │   ├── routes/          # API route definitions
│   │   ├── middleware/      # Error handler & CORS middlewares
│   │   ├── services/        # Business logic services
│   │   ├── repositories/    # Database queries
│   │   ├── utils/           # Prisma client singleton
│   │   └── server.ts        # Express server entry point
│   ├── prisma/
│   │   └── schema.prisma    # Prisma PostgreSQL schema
│   ├── scripts/
│   │   └── db-smoke-test.ts # Database CRUD smoke test
│   ├── .env.example
│   └── package.json
│
├── documentation/           # System specifications & guides
├── backups/                 # Database backup storage
├── .gitignore               # Environment & build ignores
└── README.md
```

---

## 6. PostgreSQL Database Setup

### Step A: Install PostgreSQL
If PostgreSQL is not yet installed:
1. Download PostgreSQL 16 for Windows: [https://www.enterprisedb.com/downloads/postgres-postgresql-downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)
2. Run the installer, select default components (PostgreSQL Server, Command Line Tools).
3. Set your `postgres` superuser password (remember this password).
4. Keep the default port `5432`.

### Step B: Create the Database
Open **Command Prompt** or **PowerShell** and execute:
```bash
# Log in to PostgreSQL
psql -U postgres

# Create the application database
CREATE DATABASE business_management;

# Verify creation
\l

# Exit psql
\q
```

---

## 7. Environment Variable Setup

1. In `business-management-system/backend/`, copy `.env.example` to `.env`:
   ```bash
   cp business-management-system/backend/.env.example business-management-system/backend/.env
   ```
2. Open `.env` and set your local credentials:
   ```env
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173

   # Replace YOUR_PASSWORD with your actual PostgreSQL password:
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/business_management?schema=public"
   ```
> **Security Notice:** `.env` is ignored by Git and must never be committed to source control.

---

## 8. Installation Commands

To install all dependencies for both backend and frontend:

```bash
# Option 1: Root workspace helper
npm run install:all

# Option 2: Step-by-step
cd business-management-system/backend
npm install
npx prisma generate

cd ../frontend
npm install
```

---

## 9. Starting the Application

Open two terminal windows:

### Terminal 1: Start Backend (Express API)
```bash
cd business-management-system/backend
npm run dev
```
*Backend runs on:* `http://localhost:5000`

### Terminal 2: Start Frontend (React + Vite)
```bash
cd business-management-system/frontend
npm run dev
```
*Frontend runs on:* `http://localhost:5173` (also exposed to local network)

---

## 10. Verification & Testing

### 1. Test Server Health API
Open a browser or PowerShell:
```bash
curl http://localhost:5000/api/health
```
**Expected Response:**
```json
{
  "status": "ok",
  "application": "Business Management System (BMS)",
  "version": "1.0.0",
  "environment": "development"
}
```

### 2. Test Database Connection API
```bash
curl http://localhost:5000/api/health/db
```
**Expected Response (when PostgreSQL is running):**
```json
{
  "status": "connected",
  "database": "PostgreSQL",
  "message": "Database connection verified successfully (SELECT 1 passed).",
  "latencyMs": 4
}
```

### 3. Run Safe Database Smoke Test Script
```bash
cd business-management-system/backend
npm run test:db
```
This runs `scripts/db-smoke-test.ts`, which safely verifies Phase 1 connectivity and system setting records.

### 4. Run Phase 2 Complete Database Architecture Verification
```bash
cd business-management-system/backend
npx tsx scripts/phase2-database-test.ts
```
This runs `scripts/phase2-database-test.ts`, verifying all 10 Phase 2 database architecture requirements:
1. Multi-company creation and code uniqueness.
2. Independent financial year partitioning.
3. Prevention of duplicate financial years per company.
4. Multi-company scoped party code isolation.
5. Master creation (Machines, Operators, Locations, Qualities, Grades).
6. Production books and scoped prefix uniqueness.
7. Production receive challan headers.
8. Multiple carton entries with 3-decimal precision weight formulas.
9. Joined multi-table relation graphs.
10. Referential integrity and restricted cascading deletion.

### 5. Verify Welcome Page in Browser
Navigate to `http://localhost:5173`.
The welcome page dynamically probes the API and PostgreSQL and displays real-time health badges for:
- **Frontend Status**
- **Backend API Status**
- **PostgreSQL Status**

