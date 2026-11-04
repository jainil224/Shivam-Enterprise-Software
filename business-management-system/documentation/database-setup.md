# PostgreSQL Setup Guide for Windows

This guide provides step-by-step instructions for configuring PostgreSQL for the Business Management System (BMS).

---

## 1. Official Download & Installation

1. Download the official installer for Windows:
   - **PostgreSQL 16 Windows Installer:** [https://www.enterprisedb.com/downloads/postgres-postgresql-downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)
2. Run the installer:
   - Installation Directory: Keep default (e.g. `C:\Program Files\PostgreSQL\16`).
   - Select Components: 
     - [x] PostgreSQL Server
     - [x] Command Line Tools
     - [ ] Stack Builder (Uncheck to save memory and CPU)
   - Password: Set a secure password for the `postgres` user (e.g., `postgres` or your preferred password).
   - Port: `5432`.
   - Advanced Options / Locale: Default locale.

---

## 2. Low-Resource PostgreSQL Configuration (for 4 GB RAM)

Because this laptop has 4 GB RAM, edit `postgresql.conf` (located in `C:\Program Files\PostgreSQL\16\data\postgresql.conf`):

```ini
shared_buffers = 128MB
work_mem = 4MB
maintenance_work_mem = 32MB
effective_cache_size = 512MB
max_connections = 25
```
*Restart the PostgreSQL service in Windows Services (`services.msc`) after saving changes.*

---

## 3. Database Creation

Open Command Prompt or PowerShell:

```bash
# Log in with the postgres superuser
psql -U postgres

# Create database
CREATE DATABASE business_management;

# Confirm creation
\l

# Exit
\q
```

---

## 4. Backend Environment Configuration

Open `business-management-system/backend/.env`:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Replace with your actual password and port
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/business_management?schema=public"
```

---

## 5. Prisma Migration & Smoke Test

Once the database is created and `.env` is configured:

```bash
cd business-management-system/backend

# Generate Prisma Client
npx prisma generate

# Apply initial migration
npx prisma migrate dev --name init_system_settings

# Run the database smoke test
npm run test:db
```

