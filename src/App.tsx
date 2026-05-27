import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./routes/index";
import BillingPage from "./routes/billing";
import AdvancePage from "./routes/advances";
import CustomersPage from "./routes/customers";
import ExpensesPage from "./routes/expenses";
import GirviPage from "./routes/girvi";
import InventoryPage from "./routes/inventory";
import JobWorkPage from "./routes/jobwork";
import KarigarsPage from "./routes/karigars";
import PurchasesPage from "./routes/purchases";
import RepairsPage from "./routes/repairs";
import ReportsPage from "./routes/reports";
import SalesPage from "./routes/sales";
import SchemesPage from "./routes/schemes";
import SuppliersPage from "./routes/suppliers";
import GoldRatesPage from "./routes/gold-rates";

export default function App() {
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
        <Route path="/jobwork" element={<JobWorkPage />} />
        <Route path="/karigars" element={<KarigarsPage />} />
        <Route path="/purchases" element={<PurchasesPage />} />
        <Route path="/repairs" element={<RepairsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/schemes" element={<SchemesPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/gold-rates" element={<GoldRatesPage />} />
        <Route path="*" element={<div className="flex min-h-screen items-center justify-center text-2xl font-bold text-muted-foreground">404 - Page Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}