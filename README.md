# Business Management System (BMS) — SHIVAM ENTERPRISE

> **High-Performance, Resource-Optimized On-Premises Business Management & Accounting ERP**  
> Specially engineered for Indian textile manufacturing, weaving, and trading operations.  
> Designed for seamless on-premises operation on Windows 10 (AMD E2-9000, 4 GB RAM) with LAN multi-workstation capability and zero cloud dependency.

---

## Software Visual Tour

Here is a preview of the core user interface and daily operational workflows:

### 1. Enterprise Operations Dashboard
![Enterprise Operations Dashboard](business-management-system/documentation/screenshots/phase10-2/p10_2_shell_dashboard.png)

*Central operations dashboard displaying system health, active company and financial year selectors, navigation menu, and quick access to core manufacturing, trading, and financial modules.*

---

### 2. Textile Manufacturing & Production Receive Entry
![Production Receive Entry Screen](business-management-system/documentation/screenshots/phase10-2/p10_2_shell_production_receive_entry.png)

*Fast, keyboard-driven production challan entry screen capturing machine, operator, yarn quality, lot number, target godown, and the dynamic carton weight grid with automatic gross, tare, and net calculations.*

**Live Populated Production Challan Entry Grid (#1004 — Machine: LOOM-04 | Operator: Ramesh Patel | Quality: 80/72 Micro | Lot: LOT-80/72-MP):**

| Carton No | Cops | Gross Wt (Kg) | Cops Tare (Kg) | Box Tare (Kg) | Total Tare (Kg) | Net Wt (Kg) | Avg Wt/Cop (Kg) | Twist | Lot Number | Grade |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **101** | 24 | 31.620 | 0.960 | 1.200 | 2.160 | **29.460** | 1.228 | 800 TPM | LOT-80/72-MP | 1ST |
| **102** | 24 | 32.180 | 0.960 | 1.200 | 2.160 | **30.020** | 1.251 | 800 TPM | LOT-80/72-MP | 1ST |
| **103** | 24 | 31.840 | 0.960 | 1.200 | 2.160 | **29.680** | 1.237 | 800 TPM | LOT-80/72-MP | 1ST |
| **104** | 24 | 32.450 | 0.960 | 1.200 | 2.160 | **30.290** | 1.262 | 800 TPM | LOT-80/72-MP | 1ST |
| **Total (4 Cartons)** | **96** | **128.090** | **3.840** | **4.800** | **8.640** | **119.450** | **1.244** | **800 TPM** | **LOT-80/72-MP** | **Confirmed** |

---

### 3. Production Registers & Challan Records
![Production Records & Register](business-management-system/documentation/screenshots/phase10-2/p10_2_shell_production_receive_records.png)

*Searchable production register providing real-time visibility across all recorded manufacturing challans, carton counts, net weights, and one-click actions for viewing, editing, and printing.*

---

### 4. Master Data Management
![Master Data Management](business-management-system/documentation/screenshots/phase10-2/p10_2_shell_yarn_qualities_master.png)

*Clean, structured master data management interface for defining yarn qualities, deniers, filaments, parties, machines, locations, and ledger accounts with inline validation and company-level isolation.*

---

### 5. Packing Slip & Barcode Label Document
![Printable Packing Slip & Label](business-management-system/documentation/screenshots/phase10-2/p10_2_01_complete_packing_slip.png)

*Formatted packing slip and label generator designed for thermal printers and standard A4 paper, featuring company branding, complete box and lot details, yarn weights, and barcode scanning support.*

---

### 6. A4 Portrait Document Preview
![A4 Portrait Screen Preview](business-management-system/documentation/screenshots/phase10-2/p10_2_09_a4_portrait_screen_preview.png)

*Interactive A4 portrait preview for production vouchers and challans with zoom control, pagination, and direct printer routing.*

---

### 7. Bank Reconciliation Management & Statement Print Preview
![Bank Reconciliation Register & Clearing](business-management-system/documentation/screenshots/phase10-2/bank_reconciliation_section.png)

*Live reconciliation workspace for **HDFC Bank Current A/c (50200012345678)**: bank book balance, opening statement balance, every uncleared receipt and payment with keyboard-driven clearing dates (`+` to reconcile, `-` to clear), and the always-visible "Balance as per Bank / Difference" footer.*

**Bank Reconciliation Snapshot (FY 2026 - 2027 | Period 01-04-2026 to 12-11-2026):**

| Line Item Description | Amount (Rs.) | Total (Rs.) |
|---|:---:|:---:|
| **Balance as per Company Books** (opening 5,00,000.00 + receipts 53,000.00 - payments 18,500.00) | | **5,34,500.00 Dr** |
| **Add: Cheques Issued but not Presented for Payment** | | |
| - Chq 900001 (08-05-2026) - P16 TEMP Supplier | 6,000.00 | |
| - Chq P16-TEMP-P2 (18-05-2026) - P16 TEMP Supplier | 12,500.00 | **+ 18,500.00** |
| **Less: Cheques Deposited but not Credited by Bank** | | |
| - P16-TEMP-R1 (10-05-2026) - P16 TEMP Customer | 30,000.00 | |
| - P16-TEMP-R2 (11-05-2026) - P16 TEMP Customer | 15,000.00 | |
| - P16-TEMP-R3 (02-06-2026) - P16 TEMP Customer | 8,000.00 | **- 53,000.00** |
| **Opening Statement Balance** (as at 01-04-2026) | | **5,04,500.00** |
| **Difference** | | **Not entered** (statement balance pending) |

#### Bank Reconciliation Statement (Print Preview):
![Bank Reconciliation Statement Print Preview](business-management-system/documentation/screenshots/phase10-2/bank_reconciliation_print_preview.png)

*Audit-ready A4 **Bank Reconciliation Statement** with the company header, GSTIN, reconciliation period, the classic "Balance as per our Bank Book - Add cheques issued but not presented - Less cheques deposited but not credited - Balance as per Bank Statement" layout, the saved reconciliation history log (BALANCED / UNBALANCED) and one-click PDF export.*

| BRS Section | Amount (Rs.) |
|---|:---:|
| 1. Balance as per our Bank Book | **5,34,500.00** |
| 2. Add: Cheques issued but not presented (900001 - 6,000.00 + P16-TEMP-P2 - 12,500.00) | **+ 18,500.00** |
| 3. Less: Cheques deposited but not credited (30,000.00 + 15,000.00 + 8,000.00) | **- 53,000.00** |
| 4. Balance as per Bank Statement | Not entered |
| 5. Closing Balance (Cl. Bal) | **5,00,000.00** |

---

### 8. Debit Note & Purchase Return (with Formal Print Preview & Date)
![Debit Note Entry Interface](business-management-system/documentation/screenshots/phase10-2/debit_note_entry_section.png)

*Keyboard-first Debit Note entry (F3 party lookup, F4 print, F10 change, numbered action bar) covering Sales / Purchase / Both note types, OS(+) / OS(-) / NONE outstanding effect, reason codes (Cash Discount, Quantity Discount, Rate Difference, Interest, TCS), GST input-credit ledger selection, and direct bill-to-bill allocation against the original purchase invoices.*

**Debit Note Entry Snapshot (Note DN-1 | Date 08/11/2026 | Party SHREE GANESH TEXTILES):**

| Field | Document Value |
|---|---|
| **Note No / Note Date** | **DN-1** / **08/11/2026** |
| **Party & Balance** | SHREE GANESH TEXTILES (24,034.00 Cr) |
| **Note Type / O-s Effect** | PURCHASE / NONE |
| **Reason** | Interest on Purchase |
| **Original Bills Loaded** | GST/2026/1088 (18/07/2026) and GST/2026/1042 |
| **Basic Amount / Taxable Value** | **Rs. 919.62** / **Rs. 919.62** |
| **CGST 2.50% + SGST 2.50%** | **Rs. 22.99 + Rs. 22.99** |
| **Total Debit Note** | **Rs. 966.00** |

#### Official Debit Note Document (Print Preview):
![Official Debit Note Print Preview](business-management-system/documentation/screenshots/phase10-2/debit_note_print_preview.png)

*Formal A4 Debit Note printout showing Note No (**DN-1**), **Document Date (08/11/2026)**, supplier GSTIN, the narration "Being the amount Debited to A/c. towards INTEREST ON PURCHASE", original bill reference, itemized CGST/SGST break-up, round-off and the authorised signatory block.*

| Document Field | Printed Value |
|---|---|
| **Debit Note Number** | **DN-1** |
| **Debit Note Date** | **08/11/2026** |
| **Supplier Name & GSTIN** | **SHREE GANESH TEXTILES** (27AABCT1234G1Z5, Ichalkaranji) |
| **Original Purchase Bill** | GST/2026/1088 dated 18/07/2026 - Qty 60.00, Bill Amount Rs. 12,915.00, Interest Days 113 |
| **Basic / Taxable Value** | **Rs. 919.62** / **Rs. 919.62** |
| **CGST (2.50%) + SGST (2.50%)** | **Rs. 22.99 + Rs. 22.99** |
| **Round Off (+)** | **Rs. 0.40** |
| **Total Debit Note Amount** | **Rs. 966.00** - *Rupees Nine Hundred Sixty Six Only* |
| **Ledger Posting Status** | Posted - Sundry Creditor debited, Interest on Purchase credited |

---

### 9. Bank Receipt Entry / Cheque Receipt (Phase 18)

![Cheque Receipt Book Selection](business-management-system/documentation/screenshots/phase18/p18_01_book_selection.png)

*Bank Receipt Book selection: each book binds a voucher prefix to the bank ledger that receives the money, so the register, numbering sequence and posting ledger can never drift apart. The demo book shows a live **29,000.00 Dr** balance straight from the ledger.*

![Cheque Receipt Register](business-management-system/documentation/screenshots/phase18/p18_02_cheque_receipt_register.png)

*Cheque Receipt register: every voucher with book, date, party (a multi-row receipt is tagged **2 rows / 2 parties**), bank ledger, cheque number and date, amount and status. Cancelled vouchers stay visible with their cancellation reason - numbers are never reused and rows are never hard-deleted.*

![Multi-row Cheque Receipt Entry](business-management-system/documentation/screenshots/phase18/p18_03_multi_row_entry.png)

*Multi-row cheque receipt entry: unlimited party rows in one voucher, per-row bank name, cheque number, description and amount, plus an adjustment mode of **No Adjustment / Against Bill / Skip in O/S**. The bank side posts one debit for the row total while each party row posts its own credit, so the voucher always balances.*

![Outstanding Bill Adjustment](business-management-system/documentation/screenshots/phase18/p18_04_outstanding_adjustment.png)

*Outstanding Adjustment popup: live bill-wise outstanding for the selected party with previous received, current allocation, balance after allocation, and **J.V Auto** for interest / discount style adjustments. Only **CONFIRMED purchase bills** are offered as allocation targets.*

![Cheque Receipt Print Preview](business-management-system/documentation/screenshots/phase18/p18_05_print_preview.png)

*Cheque Receipt document print preview: company header, voucher number and date, receiving bank account, one line per party row with cheque details, adjustment mode, total receipt and amount in words - plus a separate payment advice layout.*

![Cancelled Cheque Receipt (Read-only)](business-management-system/documentation/screenshots/phase18/p18_06_cancelled_read_only.png)

*Cancelled cheque receipt: the entry screen switches to a permanent read-only record showing the cancellation reason, cancellation timestamp, revision number and the original rows. Editing is append-only (a reversal revision is written) and a cancelled voucher can never be edited or renumbered.*

---

## Executive Summary & System Vision

The **Business Management System (BMS)** is a comprehensive, private enterprise ERP engineered for **SHIVAM ENTERPRISE**, a textile weaving and yarn manufacturing business. 

Built to replace fragmented legacy desktop systems, it provides lightning-fast, keyboard-driven workflows optimized for specialized textile industry operations while upgrading the underlying technology to modern, robust standards:
- **100% On-Premises & Data Sovereign:** Zero reliance on third-party cloud hosting, zero monthly subscription costs, and complete privacy for all financial and operational data.
- **Extreme Resource Efficiency:** Runs directly on low-spec hardware (tested on an AMD E2-9000 CPU with 4 GB of RAM) without the overhead of containerization (Docker) or heavy enterprise runtimes.
- **Local Area Network (LAN) Ready:** The host computer acts as a local server, allowing multiple desktop and laptop clients across the office Wi-Fi / LAN to access the system simultaneously.
- **Double-Entry Financial Accounting:** Full general ledger, accounts payable, accounts receivable, bank reconciliation, cheque receipt adjustments, and multi-book voucher systems.
- **Textile-Specific Manufacturing Operations:** Direct tracking of yarn cops, tare weights, carton gross/net calculations (to 3 decimal places), packing slips, and machine-operator logs.

---

## Core Architectural Principles

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Layer (Browser / LAN)"]
        UI["React 18 SPA (Vite + Tailwind CSS)"]
        State["Context API (Company & Modal Providers)"]
        Router["React Router v7"]
    end

    subgraph ServerLayer ["Server Layer (Node.js Host)"]
        Express["Express.js Server (Port 5000)"]
        Routes["Modular Route Handlers (/api/*)"]
        Controllers["Controller Layer (Validation & HTTP Mapping)"]
        Services["Service Layer (Business Logic & Transactions)"]
        Repos["Repository Layer (Prisma ORM Queries)"]
    end

    subgraph DatabaseLayer ["Data Persistence Layer (PostgreSQL)"]
        DB[(PostgreSQL Database: business_management)]
        Triggers["Triggers & Constraints (FY Overlap Check, Composite FKs)"]
    end

    UI -->|Axios REST API| Express
    Express --> Routes
    Routes --> Controllers
    Controllers --> Services
    Services --> Repos
    Repos -->|Prisma Client| DB
    DB --> Triggers
```

1. **Multi-Company Tenancy with Zero Data Bleed:**  
   Every record, transaction, master, sequence, and balance strictly enforces a `company_id`. Multi-column composite foreign keys at the PostgreSQL engine level ensure that transactions in Company A can never link to masters in Company B.
2. **Financial Year Partitioning & Integrity Triggers:**  
   Transactions are scoped by `financial_year_id`. A native PostgreSQL trigger (`trg_check_financial_year_overlap`) mathematically rejects overlapping fiscal periods for the same company while allowing seamless calendar transitions.
3. **Exact Numeric Precision (Zero Floating-Point Drift):**  
   - **Textile Weights:** `DECIMAL(10, 3)` (precise to 1 gram for carton tare, cops, gross, and net weights).  
   - **Financial Currency:** `DECIMAL(15, 2)` (precise to the paisa for all debit/credit journal entries, taxes, and round-offs).
4. **Controller-Service-Repository Pattern:**  
   Clean modular architecture separates routing/HTTP parsing, business validation, and database operations.
5. **Atomic Transaction Guarantees:**  
   Complex multi-table operations (e.g., Bank Receipt voucher save + bill-to-bill allocation + auto-JV generation + sequence increment) execute inside atomic `prisma.$transaction()` blocks.

---

## Technology Stack

### Frontend Application
| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | **React** | 18.3.1 | Component-based reactive UI |
| Language | **TypeScript** | 5.6.3 | Strict type safety across components |
| Bundler & Dev Server | **Vite** | 6.4.5 | Ultra-fast HMR and lightweight bundle size |
| Routing | **React Router DOM** | 7.18.5 | Client-side routing with route guards |
| Styling | **Tailwind CSS** | 3.4.16 | Utility-first, zero-runtime CSS |
| Icons | **Lucide React** | 0.468.0 | Lightweight SVG icons |
| HTTP Client | **Axios** | 1.7.9 | Request/response interceptors & timeout management |

### Backend API Server
| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Runtime | **Node.js** | v20+ / v24 LTS | Asynchronous event-driven JavaScript runtime |
| Framework | **Express.js** | 4.21.2 | Minimalist web application framework |
| Language | **TypeScript** | 5.7.2 | Type-checked server-side logic |
| Execution Engine | **tsx** | 4.19.2 | High-speed, low-memory TypeScript execution without pre-compilation |
| ORM | **Prisma ORM** | 5.22.0 | Type-safe database queries, schema migrations, and relations |
| Security & Utilities | **dotenv**, **cors** | 16.4.7 / 2.8.5 | Environment injection and cross-origin resource sharing |

### Database & Storage
| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Database Engine | **PostgreSQL** | 15 / 16 / 18 | Industrial-grade ACID-compliant relational database |
| Connection Pool | **Prisma Native Pool** | Built-in | Low-latency connection reuse |
| Document Export | **HTML5 Print & CSS Paged Media** | Native | Thermal slip and A4 challan/ledger printing |

---

## Hardware Profile & Low-Spec Performance Strategy

The system is deliberately optimized to run on low-cost office laptops, specifically benchmarked against:
- **Processor:** AMD E2-9000 RADEON R2, 2 Cores @ 1.8 GHz
- **Memory (RAM):** 4.00 GB (3.88 GB usable)
- **OS:** Windows 10 Home 64-bit

### Performance Optimization Tactics:
1. **No Docker Overhead:** Runs directly on native Windows Node.js and PostgreSQL processes, saving 1.5–2.0 GB of RAM typically consumed by Docker Desktop and Hyper-V/WSL2.
2. **Selective Prisma Field Selection:** Heavy queries select only needed scalar columns rather than deep-nesting massive relations, reducing memory consumption per request.
3. **Streamlined tsx Runner:** Backend runs with `tsx watch` during development, avoiding the double-memory overhead of running `tsc -w` alongside a separate node process.
4. **Debounced Live Searches:** Autocomplete dropdowns for Parties, Items, and Ledgers use client-side caching and debounced API calls to prevent flooding the database connection pool.
5. **Print CSS instead of Heavy Headless Browsers:** Reports and challans use browser-native `@media print` stylesheets rather than resource-heavy server-side Puppeteer/Chromium instances.

---

## Business Modules & Functional Capabilities

### Multi-Company & Financial Year Administration
- **Company Management:** Create and switch between multiple legal entities (e.g., `SHIVAM ENTERPRISE`, `SHIVAM WEAVING`).
- **Fiscal Year Partitioning:** Dynamic fiscal year creation (e.g., `2024-2025`, `2025-2026`) with lock/unlock flags and database-enforced non-overlap triggers.
- **System Health Monitor:** Real-time health API endpoints (`/api/health` and `/api/health/db`) displaying database latency and connection pool health.
- **Company & FY Context Switcher:** Global header dropdowns allow instant switching of active company and fiscal year without requiring re-login.

### Master Data Management
- **Party Master:** Complete customer, supplier, and weaver records with GSTIN, PAN, credit limits, phone, email, and linked Broker / Transporter.
- **Machine Master:** Looms, winding, and twisting machine registry with serial numbers and operational statuses.
- **Operator Master:** Shift workers, weavers, and loom operators.
- **Location Master (Godowns):** Raw material godowns, grey cloth storage, finished goods warehouses.
- **Yarn Quality & Grade Masters:** Denier, filament, quality names, and quality grades (Fresh, Seconds, Defective).
- **Report Masters:** Party Groups, Areas, Brokers, Transporters, Salespersons, Item Groups.

### Textile Manufacturing & Production Receive
- **Production Books:** Numbering series and prefix configurations for different production units.
- **Production Receive Challan Entry:** Fast keyboard-driven challan creation capturing Machine, Operator, Yarn Quality, Grade, Lot Number, and Target Godown.
- **Carton & Cops Weight Grid:**
  - Line-by-line carton weight entry.
  - Automatic Gross, Tare, and Net Weight calculations with 3-decimal precision (`DECIMAL(10, 3)`).
  - Cops count, tare per cop calculation, and automatic average net weight per cop.
- **Packing Slip & Barcode Generation:** Thermal (3-inch / 4-inch) label formats and A4 packing slips ready for printing.
- **Production Register & Challan Detail Views:** Filterable registers with date-range queries, totals, and A4 PDF export capabilities.

### Purchase Inward & GSTIN Verification
- **Purchase Books:** Scoped purchase series (e.g., Raw Yarn Inward, Grey Inward).
- **GSTIN Auto-Verification Service:** Built-in validator for Indian GST numbers with state code extraction and checksum calculation.
- **Purchase Bill Entry:** Vendor invoice recording with HSN/SAC codes, taxable amounts, and automatic CGST/SGST/IGST tax splits based on state code matching.
- **Challan-to-Bill Conversion:** Direct 1-click import of Production Receive challans into formal Purchase Bills, preventing duplicate manual entry.

### Chart of Accounts & General Ledger
- **Chart of Accounts (Ledger Account Master):**
  - Scoped accounts across Major Groups: Assets, Liabilities, Income, Expenses.
  - Sub-types: Bank Accounts, Cash Accounts, Sundry Debtors, Sundry Creditors, Direct Expenses, Indirect Taxes.
- **Double-Entry General Ledger:** Native `JournalLine` table recording Dr/Cr entries with running balances and audit trails.
- **Bank Receipts & Bank Payments:** Standard bank transaction recording with cheque numbers, clearing dates, and party selection.

### Item Master & Sales / Purchase Orders
- **Item Master:** Catalog of finished fabrics, grey cloth, and raw yarns with unit of measurement (Mtrs, Kgs, Pcs), HSN codes, and default GST rates.
- **Sales Order Entry:** Buyer contract management with delivery schedules, rate per unit, tax breakdown, and order terms.
- **Purchase Order Entry:** Supplier purchasing with quantity and rate tracking.
- **Order Fulfillment Tracking:** Real-time link between Orders and Inward Bills / Delivery Notes, displaying Pending Quantity and Fulfillment Percentage.
- **Order Reports & Print:** Printable formal Order Confirmation documents.

### Debit Notes & Purchase Returns
- **Debit Note Books:** Custom books with independent voucher numbering sequences.
- **Debit Note Entry:** Handling Purchase Returns, Rate Differences, Quality Rejections, and Shortage claims.
- **Bill-to-Bill Adjustments:** Direct mapping against original Purchase Bills to adjust outstanding balances.
- **Print Preview & Registers:** Comprehensive register with PDF preview and print formatting.

### Enterprise Reporting Engine (Bill Base)
- **High-Performance Reporting Engine:** Built to generate large-scale sales and purchase registers across thousands of records without memory spikes.
- **Configurable Column Layouts:** Save and reload custom column configurations (e.g., hide/show HSN, Broker, Transport, Tax Columns).
- **Multi-Level Grouping:** Group reports dynamically by Party, Broker, City, Area, or Quality with sub-totals and grand totals.
- **Export Capabilities:** Native Excel (.xlsx) and printable A4 landscape views.

### Bank Reconciliation Statement (BRS)
- **Bank Book Selection:** Filter by any active Bank Ledger account.
- **Statement Import & Manual Clearing:** Mark vouchers as Cleared with exact bank clearance dates.
- **Uncleared Transaction Tracking:** Real-time identification of cheques issued but not presented, and cheques deposited but not credited.
- **Automated BRS Calculation:** Balance as per Company Books vs. Balance as per Bank Statement.
- **Formal BRS Statement Printout:** Audit-ready reconciliation report compliant with Indian accounting standards.

### Bank Book & Account Ledger Reports
- **Bank Book Report:** Detailed day-by-day cash/bank register showing opening balance, debit receipts, credit payments, and closing balance.
- **Account Ledger Report:** Universal ledger drill-down for any Party or General Ledger account.
- **Date Range & Filter Options:** Flexible date selectors with running balance calculations.
- **Print & PDF Layouts:** Professional accounting ledger print views with header info, transaction table, and summary signatures.

### Bank Receipt Entry (Cheque Receipt Workflow)
*High-speed, keyboard-driven accounting workflow:*
- **Bank Receipt Book Selection:** Choose book with automatic next-voucher number generation.
- **Multi-Row Receipt Grid:** Enter multiple cheques from different parties within a single voucher.
- **Searchable Party Lookup:** Dynamic modal search by code, name, city, and current ledger balance.
- **Bank Name CODE/DESC Master:** Fast lookup of issuing banks (e.g., `SBI`, `HDFC`, `BOB`).
- **Real Outstanding Adjustment Popup:**
  - View all unpaid Purchase Bills and debit documents for the selected party.
  - Automatically or manually allocate received amounts against specific bills (`CurRec`).
  - Real-time display of Bill Amount, Prior Received (`PreRec`), Current Received, and Remaining Balance.
- **Auto-Journal Voucher (JV Auto) Adjustments:**
  - One-click adjustment for Cash Discount, Interest, TDS, Rate Differences, and Round-offs.
  - Automatically generates balancing Dr/Cr journal lines.
- **Atomic Double-Entry Posting:** Guarantees all ledger postings, voucher lines, bill allocations, and sequence increments succeed or roll back atomically.

---

## System Prerequisites

Ensure the following runtimes are installed on the host Windows machine:

| Software | Minimum Version | Recommended Version | Verification Command | Download |
|---|---|---|---|---|
| **Node.js** | v20.10.0 LTS | v24.x LTS | `node -v` | [nodejs.org](https://nodejs.org/en/download/) |
| **npm** | v10.0.0 | v11.x | `npm -v` | Bundled with Node.js |
| **PostgreSQL** | v15.0 | v16.x or v18.x | `psql --version` | [enterprisedb.com](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads) |
| **Git** | v2.40.0 | v2.47+ | `git --version` | [git-scm.com](https://git-scm.com/download/win) |

---

## Directory & Project Layout

```text
d:/SIVAM Enterprise Software/
├── package.json                   # Root workspace management script
├── README.md                      # Comprehensive system documentation (this file)
│
└── business-management-system/
    ├── package.json               # Sub-root script runner
    ├── documentation/             # System specifications, ERDs, and DB setup guides
    │   ├── architecture.md
    │   ├── database-architecture.md
    │   ├── database-setup.md
    │   └── screenshots/           # Real system screenshots and documentation assets
    │
    ├── backend/                   # Express.js + TypeScript API Server
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── .env.example           # Backend environment template
    │   ├── prisma/
    │   │   ├── schema.prisma      # Unified database schema (1700+ lines)
    │   │   └── migrations/        # Version-controlled SQL migrations
    │   ├── src/
    │   │   ├── config/            # Environment variable validation (env.ts)
    │   │   ├── controllers/       # Route request/response handlers
    │   │   ├── middleware/        # Error handlers, CORS, FY guards
    │   │   ├── repositories/      # Database access layers (Prisma queries)
    │   │   ├── services/          # Pure business logic and transactions
    │   │   ├── routes/            # Express route declarations (/api/*)
    │   │   ├── types/             # Backend TypeScript interfaces and DTOs
    │   │   ├── utils/             # Prisma client singleton, math helpers
    │   │   └── server.ts          # Express entry point (Port 5000)
    │   └── scripts/               # 40+ automated test and seeding scripts
    │
    └── frontend/                  # React 18 + Vite + Tailwind Client
        ├── package.json
        ├── vite.config.ts         # Vite bundler config (Port 5173, host: 0.0.0.0)
        ├── tailwind.config.js     # Tailwind design system configuration
        ├── index.html
        └── src/
            ├── assets/            # Static images and icons
            ├── components/        # Reusable UI controls (Modals, Dropdowns, Tables)
            │   └── receipt/       # Bank Receipt specialized components
            ├── context/           # React Context (CompanyContext, UIModalContext)
            ├── hooks/             # Custom hooks (Keyboard navigation, debounce)
            ├── layouts/           # Master RootLayout, Navigation Sidebar, Top Header
            ├── pages/             # 50+ Module View and Register Pages
            ├── services/          # Axios API service clients
            ├── types/             # Frontend TypeScript interfaces
            ├── App.tsx            # React router definitions (55+ routes)
            └── main.tsx           # React DOM root mounting
```

---

## Database Installation & Setup

### Step 1: Install PostgreSQL
1. Download PostgreSQL (v15, v16, or v18) for Windows from the official link above.
2. Run the installer with default components:
   - PostgreSQL Server
   - pgAdmin 4 (optional GUI tool)
   - Command Line Tools (`psql`)
3. Set the superuser password for user `postgres` (e.g., `postgres` or your secure password).
4. Keep the default port `5432` and default locale.

### Step 2: Create the Database
Open **Command Prompt** or **PowerShell**:

```powershell
# Connect to PostgreSQL as superuser
psql -U postgres

# Create the dedicated application database
CREATE DATABASE business_management;

# Confirm database creation
\l

# Exit psql
\q
```

---

## Environment Configuration

Navigate to `business-management-system/backend/` and copy the example environment file:

```powershell
cd "d:\SIVAM Enterprise Software\business-management-system\backend"
copy .env.example .env
```

Edit `.env` and set your database connection details:

```env
# Server Port
PORT=5000
NODE_ENV=development

# Allowed Frontend URL for CORS
FRONTEND_URL=http://localhost:5173

# PostgreSQL Connection String
# Format: postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>?schema=public
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/business_management?schema=public"
```

> **Security Note:** `.env` is ignored by Git and must never be committed to public repositories.

---

## Installation & Build Guide

From the root workspace directory (`d:\SIVAM Enterprise Software`):

```powershell
# 1. Install dependencies for both backend and frontend in one step
npm run install:all

# 2. Generate Prisma Client
cd business-management-system/backend
npx prisma generate

# 3. Apply all database migrations to PostgreSQL
npx prisma migrate dev --name init_complete_schema
```

---

## Running the Application

You can start the system using two terminal windows, or using the root workspace helper scripts.

### Terminal 1: Backend API Server
```powershell
cd "d:\SIVAM Enterprise Software"
npm run dev:backend
```
*Backend runs on:* `http://localhost:5000`  
*Health Check:* `http://localhost:5000/api/health`

### Terminal 2: Frontend Web Application
```powershell
cd "d:\SIVAM Enterprise Software"
npm run dev:frontend
```
*Frontend runs on:* `http://localhost:5173`

Once started, open your web browser (Chrome, Edge, or Firefox) and navigate to `http://localhost:5173`.

---

## LAN & Multi-User Setup

To allow other computers on your office Wi-Fi or local network (LAN) to use the BMS:

1. **Find Host IP Address:**  
   Open PowerShell on the host laptop and run:
   ```powershell
   ipconfig
   ```
   Note down the **IPv4 Address** under your active Wi-Fi or Ethernet adapter (e.g., `192.168.1.50`).

2. **Allow Ports in Windows Firewall:**  
   Run PowerShell as Administrator and allow inbound traffic on ports 5000 and 5173:
   ```powershell
   New-NetFirewallRule -DisplayName "BMS Frontend (5173)" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
   New-NetFirewallRule -DisplayName "BMS Backend (5000)" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
   ```

3. **Connect from Client Computers:**  
   On any phone, tablet, or client laptop connected to the same Wi-Fi, open the browser and visit:
   ```text
   http://192.168.1.50:5173
   ```
   All clients will connect directly to the host's database and backend in real time.

---

## Comprehensive REST API Reference

All backend API routes are prefixed with `/api`. Active company and financial year are passed via headers (`x-company-id`, `x-financial-year-id`) or query parameters.

### System & Health
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Returns server status, version, and uptime |
| `GET` | `/api/health/db` | Executes `SELECT 1` on PostgreSQL and returns query latency |

### Company & Financial Year Management
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/companies` | List all registered companies |
| `POST` | `/api/companies` | Create a new company |
| `GET` | `/api/financial-years?companyId=...` | List fiscal years for a company |
| `POST` | `/api/financial-years` | Create new fiscal year (enforces non-overlap trigger) |

### Masters Management
| Method | Endpoint | Description |
|---|---|---|
| `GET / POST` | `/api/masters/parties` | Party Master CRUD (Customers, Suppliers, Weavers) |
| `GET / POST` | `/api/masters/machines` | Loom and machinery registry |
| `GET / POST` | `/api/masters/operators` | Machine operators and shift personnel |
| `GET / POST` | `/api/masters/locations` | Warehouses and storage godowns |
| `GET / POST` | `/api/masters/yarn-qualities` | Yarn qualities and deniers |
| `GET / POST` | `/api/masters/yarn-grades` | Quality grades (Fresh, Seconds, Rejection) |
| `GET / POST` | `/api/masters/production-books` | Production voucher books |
| `GET / POST` | `/api/masters/party-groups` | Reporting Party Groups |
| `GET / POST` | `/api/masters/areas` | Geographical sales areas |
| `GET / POST` | `/api/masters/brokers` | Commission brokers and agents |
| `GET / POST` | `/api/masters/transporters` | Logistics and transport carriers |
| `GET / POST` | `/api/masters/salespersons` | Internal sales representatives |
| `GET / POST` | `/api/masters/item-groups` | Product and raw material categories |
| `GET / POST` | `/api/items` | Item Master (Finished fabric, grey, yarns) |
| `GET / POST` | `/api/ledger-accounts` | Chart of Accounts / General Ledger accounts |

### Manufacturing & Production Receive
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/manufacturing/production-receive` | List production receive challans |
| `POST` | `/api/manufacturing/production-receive` | Create challan with multi-carton weights |
| `GET` | `/api/manufacturing/production-receive/:id` | Fetch challan details and carton lines |
| `PUT` | `/api/manufacturing/production-receive/:id` | Update challan and recalculate weights |
| `DELETE`| `/api/manufacturing/production-receive/:id` | Delete challan (cascades cartons) |

### Transactions (Purchases & Returns)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/gstin/verify` | Offline syntax & checksum validation of GSTIN |
| `GET` | `/api/transactions/purchase-bills` | List purchase bills |
| `POST` | `/api/transactions/purchase-bills` | Create vendor purchase bill with tax splits |
| `GET` | `/api/transactions/debit-note-books` | List debit note books |
| `POST` | `/api/transactions/debit-notes` | Create debit note with bill-to-bill adjustments |

### Orders & Contracts (Sales & Purchase)
| Method | Endpoint | Description |
|---|---|---|
| `GET / POST` | `/api/sales-orders` | Sales Order entry and registers |
| `GET / POST` | `/api/purchase-orders` | Purchase Order entry and registers |
| `GET` | `/api/sales-orders/:id/fulfillment` | Track pending quantities and fulfillment |

### Banking & Cheque Receipts
| Method | Endpoint | Description |
|---|---|---|
| `GET / POST` | `/api/bank-receipt-books` | Manage Bank Receipt books and next voucher numbers |
| `GET` | `/api/bank-instruments/lookup` | Fast lookup of Bank codes and names |
| `GET` | `/api/bank-receipts` | List bank receipt vouchers |
| `POST` | `/api/bank-receipts` | Create multi-row bank receipt with bill allocations & auto-JV |
| `GET` | `/api/bank-receipts/party-outstanding/:partyId` | Fetch unpaid bills eligible for receipt adjustment |
| `GET / POST` | `/api/bank-payments` | Bank Payment voucher processing |

### Reports & Financial Ledgers
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/reports/bill-base` | Filterable Sales/Purchase Bill Base register |
| `GET / POST` | `/api/reports/column-layouts` | Custom column arrangement profiles |
| `GET` | `/api/reports/bank-reconciliation/:bankLedgerId` | Bank Reconciliation calculations & status |
| `POST` | `/api/reports/bank-reconciliation/:bankLedgerId/mark` | Clear/un-clear bank transactions |
| `GET` | `/api/reports/bank-book` | Bank Book transactions with running balances |
| `GET` | `/api/reports/account-ledger` | General Ledger transactions for any party/account |

---

## Automated Verification & Test Suite

The backend contains over **40 automated end-to-end test and verification scripts** located in `business-management-system/backend/scripts/`.

Run these tests via PowerShell to verify system integrity:

```powershell
cd "d:\SIVAM Enterprise Software\business-management-system\backend"

# 1. Database connection & settings smoke test
npm run test:db

# 2. Database Architecture & Referential Integrity
npx tsx scripts/phase2-database-test.ts
npx tsx scripts/phase2-1-integrity-test.ts

# 3. Master records validation (Parties, Machines, Qualities)
npx tsx scripts/phase5-master-test.ts

# 4. Production Receive & Dynamic Carton Weight calculation
npx tsx scripts/phase7-production-receive-test.ts
npx tsx scripts/phase10-carton-entry-test.ts

# 5. GSTIN & Purchase Bill calculation tests
npm run test:gstin
npx tsx scripts/phase11-gstin-purchase-bill-test.ts

# 6. Double-entry Bank Voucher verification
npm run test:phase12

# 7. Sales & Purchase Order fulfillment test
npm run test:phase13

# 8. Debit Note & Bill-to-Bill adjustment test
npm run test:phase14

# 9. Reporting Engine (Bill Base, Grouping, Performance)
npm run test:phase15
npm run test:phase15.1
npm run test:phase15.2

# 10. Bank Reconciliation Statement (BRS) test
npm run test:phase16
npm run test:phase16.1

# 11. Bank Book & Account Ledger report tests
npm run test:phase17
npm run test:phase17.1
```

---

## Accounting Engine & Transaction Rules

### Double-Entry Integrity Rules
- Every financial voucher (Bank Receipt, Bank Payment, Debit Note, Purchase Bill, Journal) creates balanced rows in `journal_lines`:
  $$\sum \text{Debit Amount} = \sum \text{Credit Amount}$$
- Unbalanced transactions are rejected at the service layer and will abort the database transaction.

### Bank Receipt Cheque Adjustment Formula
When allocating a received cheque against outstanding bills:
$$\text{Remaining Balance} = \text{Original Bill Amount} - (\text{PreRec} + \text{CurRec})$$
Where:
- $\text{PreRec}$: Amount received and settled in previous vouchers.
- $\text{CurRec}$: Amount currently allocated in this voucher row.

### Auto-Journal Voucher (JV Auto) Calculations
For cash discounts or interest charged during receipt settlement:
$$\text{Net Settlement} = \text{CurRec} + \text{Discount Allowed} - \text{Interest Received} - \text{TDS Deducted}$$
The system automatically posts compensating Debit/Credit lines to the designated Discount/Interest/TDS ledger accounts.

---

## Troubleshooting & Maintenance

### 1. Database Connection Refused (`ECONNREFUSED 127.0.0.1:5432`)
- **Cause:** PostgreSQL service is stopped.
- **Fix:** Open Windows Services (`services.msc`), find **postgresql-x64-XX**, and click **Start**.

### 2. Port Conflict (`EADDRINUSE: port 5000 or 5173`)
- **Cause:** A previous instance of the server did not terminate cleanly.
- **Fix:** In PowerShell, find and kill the process:
  ```powershell
  # Find PID using port 5000
  Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
  ```

### 3. Prisma Schema Out of Sync
- **Fix:** Whenever models are modified in `schema.prisma`:
  ```powershell
  cd business-management-system/backend
  npx prisma generate
  npx prisma migrate dev
  ```

### 4. Database Backup & Disaster Recovery
To create a complete SQL backup of your data:
```powershell
# Create backup directory if not exists
mkdir "d:\SIVAM Enterprise Software\backups" -Force

# Export complete database dump
pg_dump -U postgres -d business_management -F c -b -v -f "d:\SIVAM Enterprise Software\backups\bms_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"
```

To restore from a backup file:
```powershell
pg_restore -U postgres -d business_management -v "d:\SIVAM Enterprise Software\backups\YOUR_BACKUP_FILE.dump"
```

---

## Future Roadmap

- [ ] **Sales Invoicing & Delivery Challans:** Direct conversion of Sales Orders to tax invoices with e-Invoice QR code integration.
- [ ] **E-Way Bill Generation:** JSON export compatible with the Indian Government E-Way Bill portal.
- [ ] **Barcode Scanner Integration:** Direct USB / Bluetooth barcode scanner input for high-speed warehouse carton inward and dispatch.
- [ ] **GST JSON Returns:** Automated generation of GSTR-1 and GSTR-3B monthly summary files.
- [ ] **Automated Daily Backups:** Background Windows Task Scheduler job to create zipped daily database snapshots.

---

**Coded and Designed by Jainil Patel**
