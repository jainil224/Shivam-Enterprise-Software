import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { DashboardPage } from './pages/DashboardPage';
import { CompanySelectionPage } from './pages/CompanySelectionPage';
import { WelcomePage } from './pages/WelcomePage';
import { PartyMasterPage } from './pages/PartyMasterPage';
import { MachineMasterPage } from './pages/MachineMasterPage';
import { OperatorMasterPage } from './pages/OperatorMasterPage';
import { LocationMasterPage } from './pages/LocationMasterPage';
import { YarnQualityMasterPage } from './pages/YarnQualityMasterPage';
import { YarnGradeMasterPage } from './pages/YarnGradeMasterPage';
import { ProductionBookMasterPage } from './pages/ProductionBookMasterPage';
import { ProductionBookSelectionPage } from './pages/ProductionBookSelectionPage';
import { ProductionReceiveEntryPage } from './pages/ProductionReceiveEntryPage';
import { ProductionRegisterPage } from './pages/ProductionRegisterPage';
import { ProductionChallanDetailPage } from './pages/ProductionChallanDetailPage';
import { ProductionChallanPrintPage } from './pages/ProductionChallanPrintPage';
import { PackingSlipPrintPage } from './pages/PackingSlipPrintPage';
import { PurchaseRegisterPage } from './pages/PurchaseRegisterPage';
import { PurchaseBillEntryPage } from './pages/PurchaseBillEntryPage';
import { PurchaseBillDetailPage } from './pages/PurchaseBillDetailPage';
import { LedgerAccountsPage } from './pages/LedgerAccountsPage';
import { BankVoucherRegisterPage } from './pages/BankVoucherRegisterPage';
import { BankVoucherEntryPage } from './pages/BankVoucherEntryPage';
import { BankVoucherDetailPage } from './pages/BankVoucherDetailPage';
import { BankVoucherPrintPage } from './pages/BankVoucherPrintPage';
import { ItemMasterPage } from './pages/ItemMasterPage';
import { OrderEntryPage } from './pages/OrderEntryPage';
import { OrderRegisterPage } from './pages/OrderRegisterPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { OrderPrintPage } from './pages/OrderPrintPage';
import { OrderReportsPage } from './pages/OrderReportsPage';
import { DebitNoteBookSelectionPage } from './pages/DebitNoteBookSelectionPage';
import { DebitNoteEntryPage } from './pages/DebitNoteEntryPage';
import { DebitNoteRegisterPage } from './pages/DebitNoteRegisterPage';
import { DebitNotePrintPreviewPage } from './pages/DebitNotePrintPreviewPage';
import { ReportMastersPage } from './pages/ReportMastersPage';
import { ReportBillBaseConfigPage } from './pages/ReportBillBaseConfigPage';
import { ReportBillBaseResultsPage } from './pages/ReportBillBaseResultsPage';
import { ReportBillBasePrintPage } from './pages/ReportBillBasePrintPage';
import { BankReconciliationBookSelectionPage } from './pages/BankReconciliationBookSelectionPage';
import { BankReconciliationPage } from './pages/BankReconciliationPage';
import { BankReconciliationPrintPage } from './pages/BankReconciliationPrintPage';
import { CompanyProvider } from './context/CompanyContext';
import { UIModalProvider } from './context/UIModalContext';
import { RequireCompanyContext } from './components/RequireCompanyContext';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <CompanyProvider>
        <UIModalProvider>
          <RootLayout>
            <Routes>
              {/* Dashboard is the default landing page protected by CompanyContext */}
              <Route
                path="/"
                element={
                  <RequireCompanyContext>
                    <DashboardPage />
                  </RequireCompanyContext>
                }
              />

              {/* Master Management Routes (Phase 5) */}
              <Route
                path="/masters/parties"
                element={
                  <RequireCompanyContext>
                    <PartyMasterPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/masters/machines"
                element={
                  <RequireCompanyContext>
                    <MachineMasterPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/masters/operators"
                element={
                  <RequireCompanyContext>
                    <OperatorMasterPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/masters/locations"
                element={
                  <RequireCompanyContext>
                    <LocationMasterPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/masters/yarn-qualities"
                element={
                  <RequireCompanyContext>
                    <YarnQualityMasterPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/masters/yarn-grades"
                element={
                  <RequireCompanyContext>
                    <YarnGradeMasterPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/masters/production-books"
                element={
                  <RequireCompanyContext>
                    <ProductionBookMasterPage />
                  </RequireCompanyContext>
                }
              />

              {/* Company Selection & Setup */}
              <Route path="/companies" element={<CompanySelectionPage />} />

              {/* Manufacturing Routes (Phase 6, 7 & 8) */}
              <Route
                path="/manufacturing/production-receive/books"
                element={
                  <RequireCompanyContext>
                    <ProductionBookSelectionPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/manufacturing/production-receive/entry"
                element={
                  <RequireCompanyContext>
                    <ProductionReceiveEntryPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/manufacturing/production-receive/records"
                element={
                  <RequireCompanyContext>
                    <ProductionRegisterPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/manufacturing/production-receive/records/:id"
                element={
                  <RequireCompanyContext>
                    <ProductionChallanDetailPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/manufacturing/production-receive/records/:id/print"
                element={
                  <RequireCompanyContext>
                    <ProductionChallanPrintPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/manufacturing/packing-slip/print"
                element={
                  <RequireCompanyContext>
                    <PackingSlipPrintPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/manufacturing/production-receive/packing-slip"
                element={
                  <RequireCompanyContext>
                    <PackingSlipPrintPage />
                  </RequireCompanyContext>
                }
              />

              {/* Transactions — Purchase & Inward (Phase 11) */}
              <Route
                path="/transactions/purchase"
                element={
                  <RequireCompanyContext>
                    <PurchaseRegisterPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/purchase/new"
                element={
                  <RequireCompanyContext>
                    <PurchaseBillEntryPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/purchase/create-from-challan/:challanId"
                element={
                  <RequireCompanyContext>
                    <PurchaseBillEntryPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/purchase/:id"
                element={
                  <RequireCompanyContext>
                    <PurchaseBillDetailPage />
                  </RequireCompanyContext>
                }
              />

              {/* Ledger & Bank Account Master (Phase 12) */}
              <Route
                path="/masters/report-masters"
                element={
                  <RequireCompanyContext>
                    <ReportMastersPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/masters/ledger-accounts"
                element={
                  <RequireCompanyContext>
                    <LedgerAccountsPage />
                  </RequireCompanyContext>
                }
              />

              {/* Bank Receipts (Phase 12) */}
              <Route
                path="/transactions/bank-receipts"
                element={
                  <RequireCompanyContext>
                    <BankVoucherRegisterPage voucherType="RECEIPT" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/bank-receipts/new"
                element={
                  <RequireCompanyContext>
                    <BankVoucherEntryPage voucherType="RECEIPT" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/bank-receipts/:id/edit"
                element={
                  <RequireCompanyContext>
                    <BankVoucherEntryPage voucherType="RECEIPT" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/bank-receipts/:id/print"
                element={
                  <RequireCompanyContext>
                    <BankVoucherPrintPage voucherType="RECEIPT" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/bank-receipts/:id"
                element={
                  <RequireCompanyContext>
                    <BankVoucherDetailPage voucherType="RECEIPT" />
                  </RequireCompanyContext>
                }
              />

              {/* Bank Payments (Phase 12) */}
              <Route
                path="/transactions/bank-payments"
                element={
                  <RequireCompanyContext>
                    <BankVoucherRegisterPage voucherType="PAYMENT" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/bank-payments/new"
                element={
                  <RequireCompanyContext>
                    <BankVoucherEntryPage voucherType="PAYMENT" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/bank-payments/:id/edit"
                element={
                  <RequireCompanyContext>
                    <BankVoucherEntryPage voucherType="PAYMENT" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/bank-payments/:id/print"
                element={
                  <RequireCompanyContext>
                    <BankVoucherPrintPage voucherType="PAYMENT" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/bank-payments/:id"
                element={
                  <RequireCompanyContext>
                    <BankVoucherDetailPage voucherType="PAYMENT" />
                  </RequireCompanyContext>
                }
              />

              {/* Item Master (Phase 13) */}
              <Route
                path="/masters/items"
                element={
                  <RequireCompanyContext>
                    <ItemMasterPage />
                  </RequireCompanyContext>
                }
              />

              {/* Sales Orders (Phase 13) */}
              <Route
                path="/transactions/sales-orders/reports"
                element={
                  <RequireCompanyContext>
                    <OrderReportsPage documentType="SALES_ORDER" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/sales-orders/new"
                element={
                  <RequireCompanyContext>
                    <OrderEntryPage documentType="SALES_ORDER" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/sales-orders/:id/edit"
                element={
                  <RequireCompanyContext>
                    <OrderEntryPage documentType="SALES_ORDER" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/sales-orders/:id/print"
                element={
                  <RequireCompanyContext>
                    <OrderPrintPage documentType="SALES_ORDER" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/sales-orders/:id"
                element={
                  <RequireCompanyContext>
                    <OrderDetailPage documentType="SALES_ORDER" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/sales-orders"
                element={
                  <RequireCompanyContext>
                    <OrderRegisterPage documentType="SALES_ORDER" />
                  </RequireCompanyContext>
                }
              />

              {/* Purchase Orders (Phase 13) */}
              <Route
                path="/transactions/purchase-orders/reports"
                element={
                  <RequireCompanyContext>
                    <OrderReportsPage documentType="PURCHASE_ORDER" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/purchase-orders/new"
                element={
                  <RequireCompanyContext>
                    <OrderEntryPage documentType="PURCHASE_ORDER" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/purchase-orders/:id/edit"
                element={
                  <RequireCompanyContext>
                    <OrderEntryPage documentType="PURCHASE_ORDER" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/purchase-orders/:id/print"
                element={
                  <RequireCompanyContext>
                    <OrderPrintPage documentType="PURCHASE_ORDER" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/purchase-orders/:id"
                element={
                  <RequireCompanyContext>
                    <OrderDetailPage documentType="PURCHASE_ORDER" />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/purchase-orders"
                element={
                  <RequireCompanyContext>
                    <OrderRegisterPage documentType="PURCHASE_ORDER" />
                  </RequireCompanyContext>
                }
              />

              {/* Debit Notes (Phase 14) */}
              <Route
                path="/transactions/debit-notes/books"
                element={
                  <RequireCompanyContext>
                    <DebitNoteBookSelectionPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/debit-notes/new"
                element={
                  <RequireCompanyContext>
                    <DebitNoteEntryPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/debit-notes/:id/edit"
                element={
                  <RequireCompanyContext>
                    <DebitNoteEntryPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/debit-notes/:id/print"
                element={
                  <RequireCompanyContext>
                    <DebitNotePrintPreviewPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/debit-notes/:id"
                element={
                  <RequireCompanyContext>
                    <DebitNoteEntryPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/transactions/debit-notes"
                element={
                  <RequireCompanyContext>
                    <DebitNoteRegisterPage />
                  </RequireCompanyContext>
                }
              />

              {/* Phase 15 - Sales & Purchase Report (Bill Base) */}
              <Route
                path="/reports/sales-purchase/bill-base"
                element={
                  <RequireCompanyContext>
                    <ReportBillBaseConfigPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/reports/sales-purchase/bill-base/results"
                element={
                  <RequireCompanyContext>
                    <ReportBillBaseResultsPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/reports/sales-purchase/bill-base/print"
                element={
                  <RequireCompanyContext>
                    <ReportBillBasePrintPage />
                  </RequireCompanyContext>
                }
              />

              {/* Phase 16 - Bank Reconciliation */}
              <Route
                path="/reports/bank-reconciliation"
                element={
                  <RequireCompanyContext>
                    <BankReconciliationBookSelectionPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/reports/bank-reconciliation/:bankLedgerId/print"
                element={
                  <RequireCompanyContext>
                    <BankReconciliationPrintPage />
                  </RequireCompanyContext>
                }
              />
              <Route
                path="/reports/bank-reconciliation/:bankLedgerId"
                element={
                  <RequireCompanyContext>
                    <BankReconciliationPage />
                  </RequireCompanyContext>
                }
              />

              {/* Technical System Status & Health */}
              <Route path="/system-status" element={<WelcomePage />} />

              {/* Catch-all redirects to Dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </RootLayout>
        </UIModalProvider>
      </CompanyProvider>
    </BrowserRouter>
  );
};

export default App;
