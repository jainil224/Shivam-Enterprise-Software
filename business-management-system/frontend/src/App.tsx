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
