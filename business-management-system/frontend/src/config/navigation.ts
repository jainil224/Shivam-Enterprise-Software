import {
  ShoppingCart,
  Truck,
  ShoppingBag,
  FileSpreadsheet,
  AlertCircle,
  FileMinus,
  FilePlus,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Coins,
  Scale,
  LineChart,
  PieChart,
  Landmark,
  ClipboardList,
  FileCheck,
  LucideIcon
} from 'lucide-react';

export interface ShortcutItem {
  id: string;
  title: string;
  description: string;
  category: 'Sales' | 'Purchase' | 'Vouchers' | 'Reports' | 'Orders' | 'Manufacturing';
  icon: LucideIcon;
  plannedPhase: string;
  implemented: boolean;
  route?: string;
  hotkey?: string;
}

export const DASHBOARD_SHORTCUTS: ShortcutItem[] = [
  // --- Sales & Dispatch ---
  {
    id: 'sales',
    title: 'Sales',
    description: 'Yarn sales invoices, rate master, GST invoices and customer delivery bills.',
    category: 'Sales',
    icon: ShoppingCart,
    plannedPhase: 'Phase 7 (Sales & Invoicing)',
    implemented: false,
  },
  {
    id: 'delivery_challan',
    title: 'Delivery Challan',
    description: 'Outgoing delivery notes, yarn delivery challans and dispatch memos.',
    category: 'Sales',
    icon: Truck,
    plannedPhase: 'Phase 7 (Sales & Invoicing)',
    implemented: false,
  },
  {
    id: 'credit_note',
    title: 'Credit Note',
    description: 'Sales return adjustments, rate differences and customer credit vouchers.',
    category: 'Sales',
    icon: FileMinus,
    plannedPhase: 'Phase 7 (Sales & Invoicing)',
    implemented: false,
  },
  {
    id: 'sales_order',
    title: 'Sales Order',
    description: 'Advance sales bookings, buyer order confirmations and yarn delivery commitments.',
    category: 'Orders',
    icon: ClipboardList,
    plannedPhase: 'Phase 7 (Sales & Invoicing)',
    implemented: false,
  },

  // --- Purchases ---
  {
    id: 'purchase',
    title: 'Purchase',
    description: 'Raw yarn and texturised polyester purchase inward entries and bills.',
    category: 'Purchase',
    icon: ShoppingBag,
    plannedPhase: 'Phase 11 (Purchase & Inward)',
    implemented: true,
    route: '/transactions/purchase',
  },
  {
    id: 'general_purchase',
    title: 'General Purchase',
    description: 'Consumables, packaging paper tubes, cartons and mill supply purchases.',
    category: 'Purchase',
    icon: FileSpreadsheet,
    plannedPhase: 'Phase 8 (Purchase & Inward)',
    implemented: false,
  },
  {
    id: 'debit_note',
    title: 'Debit Note',
    description: 'Purchase returns, supplier weight deductions and purchase adjustments.',
    category: 'Purchase',
    icon: FilePlus,
    plannedPhase: 'Phase 8 (Purchase & Inward)',
    implemented: false,
  },
  {
    id: 'purchase_order',
    title: 'Purchase Order',
    description: 'Raw material procurement orders and yarn purchase contracts.',
    category: 'Orders',
    icon: FileCheck,
    plannedPhase: 'Phase 8 (Purchase & Inward)',
    implemented: false,
  },

  // --- Banking & Cash Vouchers ---
  {
    id: 'bank_receipt',
    title: 'Bank Receipt',
    description: 'Customer RTGS, NEFT, cheque receipts and bank account ledger credits.',
    category: 'Vouchers',
    icon: ArrowDownLeft,
    plannedPhase: 'Phase 9 (Accounting & Financial Vouchers)',
    implemented: false,
  },
  {
    id: 'bank_payment',
    title: 'Bank Payment',
    description: 'Supplier RTGS/cheque payouts, expenses and bank disbursements.',
    category: 'Vouchers',
    icon: ArrowUpRight,
    plannedPhase: 'Phase 9 (Accounting & Financial Vouchers)',
    implemented: false,
  },
  {
    id: 'cash_payment',
    title: 'Cash Payment',
    description: 'Factory petty cash payments, driver advances and daily labor wages.',
    category: 'Vouchers',
    icon: Wallet,
    plannedPhase: 'Phase 9 (Accounting & Financial Vouchers)',
    implemented: false,
  },
  {
    id: 'cash_receipt',
    title: 'Cash Receipt',
    description: 'Cash collections, customer advances and contra cash inward vouchers.',
    category: 'Vouchers',
    icon: Coins,
    plannedPhase: 'Phase 9 (Accounting & Financial Vouchers)',
    implemented: false,
  },

  // --- Accounts & Financial Reports ---
  {
    id: 'outstanding',
    title: 'Outstanding',
    description: 'Party-wise receivables (debtors) and payables (creditors) aging balances.',
    category: 'Reports',
    icon: AlertCircle,
    plannedPhase: 'Phase 9 (Accounting & Financial Reports)',
    implemented: false,
  },
  {
    id: 'trial_balance',
    title: 'Trial Balance',
    description: 'Detailed and group-wise trial balance verifying debits and credits.',
    category: 'Reports',
    icon: Scale,
    plannedPhase: 'Phase 9 (Accounting & Financial Reports)',
    implemented: false,
  },
  {
    id: 'trading_account',
    title: 'Trading Account',
    description: 'Direct manufacturing costs, yarn consumption and gross profit calculations.',
    category: 'Reports',
    icon: LineChart,
    plannedPhase: 'Phase 9 (Accounting & Financial Reports)',
    implemented: false,
  },
  {
    id: 'profit_loss',
    title: 'Profit & Loss',
    description: 'Periodic net profit analysis, operational overheads and business P&L.',
    category: 'Reports',
    icon: PieChart,
    plannedPhase: 'Phase 9 (Accounting & Financial Reports)',
    implemented: false,
  },
  {
    id: 'balance_sheet',
    title: 'Balance Sheet',
    description: 'Comprehensive financial position statement, assets and liabilities.',
    category: 'Reports',
    icon: Landmark,
    plannedPhase: 'Phase 9 (Accounting & Financial Reports)',
    implemented: false,
  },
];

// -------------------------------------------------------------
// Manufacturing Menu Hierarchy
// -------------------------------------------------------------
export interface MenuItem {
  title: string;
  description?: string;
  plannedPhase?: string;
  implemented?: boolean;
  route?: string;
  action?: string;
  children?: MenuItem[];
}

export const MANUFACTURING_MENU_ITEMS: MenuItem[] = [
  {
    title: '1. Production Receive',
    description: 'Yarn production receive entries, carton tagging, and daily receipts.',
    children: [
      {
        title: 'Entry',
        description: 'Select a production book and begin a new production receive challan.',
        plannedPhase: 'Phase 6 & 7 (Production Receive Entry)',
        implemented: true,
        route: '/manufacturing/production-receive/books',
      },
      {
        title: 'Challan Register (List-F5)',
        description: 'View, search, edit, cancel and print all saved production challans.',
        plannedPhase: 'Phase 8 & 9 (Challan Register & Printing)',
        implemented: true,
        route: '/manufacturing/production-receive/records',
      },
      {
        title: 'Production Reports',
        description: 'Machine-wise, operator-wise, and date-wise production summary.',
        plannedPhase: 'Phase 6 (Production Receive & Challan Printing)',
        implemented: false,
      },
      {
        title: 'Cartoon Stock Report',
        description: 'Inventory of finished yarn cartons by quality and grade.',
        plannedPhase: 'Phase 6 (Production Receive & Challan Printing)',
        implemented: false,
      },
      {
        title: 'Machine Master',
        description: 'Configuration of twisting, texturising, and winding machines.',
        plannedPhase: 'Phase 5 (Master Management)',
        implemented: false,
      },
      {
        title: 'Item Production',
        description: 'Yarn quality production statistics and spool output analysis.',
        plannedPhase: 'Phase 6 (Production Receive & Challan Printing)',
        implemented: false,
      },
      {
        title: 'Cartoon Mistakes',
        description: 'Defective carton logs, weight variances, and quality error tracking.',
        plannedPhase: 'Phase 6 (Production Receive & Challan Printing)',
        implemented: false,
      },
      {
        title: 'Re-Pack Issue',
        description: 'Issue of downgraded or returned cartons for re-sorting and packing.',
        plannedPhase: 'Phase 6 (Production Receive & Challan Printing)',
        implemented: false,
      },
      {
        title: 'Re-Pack Receive',
        description: 'Receipt of freshly repacked cartons back into active warehouse inventory.',
        plannedPhase: 'Phase 6 (Production Receive & Challan Printing)',
        implemented: false,
      },
    ],
  },
  {
    title: '2. Beam Entry / Report',
    description: 'Warping beam inward, yarn length, tension registers, and beam production logs.',
    plannedPhase: 'Phase 10 (Advanced Manufacturing & Weaving)',
    implemented: false,
  },
  {
    title: '3. Job and Inventory',
    description: 'Third-party job work orders, outside twisting job cards, and contractor ledger.',
    plannedPhase: 'Phase 10 (Job Work & Outward Manufacturing)',
    implemented: false,
  },
  {
    title: '4. Consumption',
    description: 'Raw yarn to finished yarn batch conversion, yield ratios, and wastage analysis.',
    plannedPhase: 'Phase 10 (Manufacturing Consumption & Yield)',
    implemented: false,
  },
  {
    title: '5. Stock',
    description: 'Comprehensive raw yarn, WIP, and finished carton warehouse inventory.',
    plannedPhase: 'Phase 10 (Warehouse Stock Management)',
    implemented: false,
  },
  {
    title: '6. Stock Settings',
    description: 'Minimum stock level thresholds, reorder points, and warehouse bins.',
    plannedPhase: 'Phase 10 (Inventory Configuration)',
    implemented: false,
  },
  {
    title: '7. Salary Module',
    description: 'Machine operator piece-rate wages, attendance, and monthly salary rolls.',
    plannedPhase: 'Phase 11 (Payroll & Operator Wages)',
    implemented: false,
  },
];
