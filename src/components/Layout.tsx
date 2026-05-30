import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Users,
  Receipt,
  Gem,
  Wallet,
  HandCoins,
  Landmark,
  Truck,
  Hammer,
  Wrench,
  PiggyBank,
  ShoppingBag,
  TrendingUp,
  ShoppingCart,
  BarChart3,
  Menu,
  BookOpen,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const groups: { title: string; items: NavItem[] }[] = [
  { title: "Overview", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }] },
  { title: "Sales", items: [
    { to: "/billing", label: "POS / Billing", icon: ShoppingCart },
    { to: "/sales", label: "Sales", icon: Receipt },
    { to: "/orders", label: "Orders", icon: ShoppingBag },
  ]},
  { title: "Inventory", items: [
    { to: "/inventory", label: "Products", icon: Package },
    { to: "/gold-rates", label: "Gold Rates", icon: TrendingUp },
  ]},
  { title: "People", items: [
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/suppliers", label: "Suppliers", icon: Truck },
    { to: "/karigars", label: "Karigars", icon: Hammer },
  ]},
  { title: "Operations", items: [
    { to: "/repairs", label: "Repairs", icon: Wrench },
    { to: "/schemes", label: "Schemes", icon: PiggyBank },
  ]},
  { title: "Finance", items: [
    { to: "/purchases", label: "Purchases", icon: ShoppingBag },
    { to: "/expenses", label: "Expenses", icon: Wallet },
    { to: "/advances", label: "Advance", icon: HandCoins },
    { to: "/girvi", label: "Girvi (Loans)", icon: Landmark },
    { to: "/reports", label: "Reports", icon: BarChart3 },
    { to: "/ledger", label: "Daily Ledger", icon: BookOpen },
  ]},
];

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="px-6 py-6 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-md bg-primary text-primary-foreground grid place-items-center">
            <Gem className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display text-lg leading-none">cloudiefy</div>
            <div className="text-xs text-muted-foreground mt-0.5">Jewelry software</div>
          </div>
        </div>
        {onNavigate && (
          <button onClick={onNavigate} className="lg:hidden p-1 rounded hover:bg-sidebar-accent" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <ScrollArea className="flex-1">
        <nav className="p-3">
          {groups.map((g) => (
            <div key={g.title} className="mb-3">
              <div className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{g.title}</div>
              {g.items.map((n) => {
                const Icon = n.icon;
                return (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.to === "/"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )
                    }
                  >
                    <Icon className="w-4 h-4" />
                    {n.label}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>
      <div className="p-4 text-xs text-muted-foreground border-t border-sidebar-border">
        <div>CLOUDIEFY @ 2026</div>
        <a
          href="https://www.cloudiefy.com/"
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-primary underline hover:text-primary-foreground"
        >
          Built with cloudiefy team
        </a>
      </div>
    </>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex-col h-full">
        <SidebarBody />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setOpen(false);
            }}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col shadow-xl h-full">
            <SidebarBody
              onNavigate={() => {
                setOpen(false);
              }}
            />
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden shrink-0 sticky top-0 z-30 flex items-center gap-3 px-4 h-14 border-b border-sidebar-border bg-sidebar/95 backdrop-blur">
          <button
            onClick={() => {
              setOpen(true);
            }}
            className="p-2 -ml-2 rounded hover:bg-sidebar-accent"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <Gem className="w-4 h-4" />
            </div>
            <div className="font-display text-base leading-none">cloudiefy</div>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
        </ScrollArea>
      </main>
    </div>
  );
}
