import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./routes/index";
import BillingPage from "./routes/billing";
import AdvancePage from "./routes/advances";
import CustomersPage from "./routes/customers";
import ExpensesPage from "./routes/expenses";
import GirviPage from "./routes/girvi";
import InventoryPage from "./routes/inventory";
import KarigarsPage from "./routes/karigars";
import PurchasesPage from "./routes/purchases";
import RepairsPage from "./routes/repairs";
import ReportsPage from "./routes/reports";
import SalesPage from "./routes/sales";
import SchemesPage from "./routes/schemes";
import SuppliersPage from "./routes/suppliers";
import GoldRatesPage from "./routes/gold-rates";
import OrdersPage from "./routes/orders";
import LedgerPage from "./routes/ledger";
import DuesPage from "./routes/dues";
import ForwardedShopsPage from "./routes/forwarded-shops";
import KarigarTasksPage from "./routes/karigar-tasks";
import NotificationsPage from "./routes/notifications";
import LoginPage from "./routes/login";
import { useLocalState } from "./lib/storage";

export default function App() {
  // Stores the login state securely in the local storage so it persists on refresh
  const [authUser, setAuthUser] = useLocalState<any>("ajms.auth", null);

  if (!authUser) {
    return <LoginPage onLogin={(user) => setAuthUser(user)} />;
  }

  // STRIKED DOWN KARIGAR ROUTE
  if (authUser.role === "karigar") {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/karigar-tasks" element={<KarigarTasksPage />} />
          <Route path="*" element={<Navigate to="/karigar-tasks" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/advances" element={<AdvancePage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/girvi" element={<GirviPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/karigars" element={<KarigarsPage />} />
        <Route path="/purchases" element={<PurchasesPage />} />
        <Route path="/repairs" element={<RepairsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/schemes" element={<SchemesPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/gold-rates" element={<GoldRatesPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/ledger" element={<LedgerPage />} />
        <Route path="/dues" element={<DuesPage />} />
        <Route path="/forwarded-shops" element={<ForwardedShopsPage />} />
        <Route path="/karigar-tasks" element={<KarigarTasksPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="*" element={<div className="flex min-h-screen items-center justify-center text-2xl font-bold text-muted-foreground">404 - Page Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}