import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { inr, type Expense } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { expensesAPI } from "@/lib/api";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

const CATEGORIES = ["Rent", "Salary", "Utilities", "Purchase", "Repair", "Marketing", "Misc"];

export default function ExpensesPage() {
  const { data: expenses = [], isLoading } = useApi<Expense[]>(["expenses"], () => expensesAPI.getAll());
  const createMutation = useApiMutation((data: Expense) => expensesAPI.create(data), ["expenses"]);
  const deleteMutation = useApiMutation((id: string) => expensesAPI.delete(id), ["expenses"]);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState<Omit<Expense, "id">>({
    date: new Date().toISOString().slice(0, 10),
    category: "Rent",
    description: "",
    amount: 0,
    paymentMode: "Cash",
  });

  const now = new Date();
  const todayStr = now.toDateString();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;

  const todayTotal = useMemo(
    () => expenses.filter((e) => new Date(e.date).toDateString() === todayStr).reduce((s, e) => s + e.amount, 0),
    [expenses, todayStr]
  );
  const monthTotal = useMemo(
    () => expenses.filter((e) => {
      const d = new Date(e.date);
      return `${d.getFullYear()}-${d.getMonth()}` === monthKey;
    }).reduce((s, e) => s + e.amount, 0),
    [expenses, monthKey]
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses
      .filter((e) => {
        const d = new Date(e.date);
        return `${d.getFullYear()}-${d.getMonth()}` === monthKey;
      })
      .forEach((e) => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses, monthKey]);

  async function add() {
    if (!form.amount || !form.description) return;
    try {
      await createMutation.mutateAsync(form as any);
      setForm({ ...form, description: "", amount: 0 });
    } catch (error) {
      console.error("[Expenses] Error saving to DB:", error);
    }
  }

  async function remove(id: string) {
    await deleteMutation.mutateAsync(id);
  }

  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Expenses</h1>
          <p className="text-muted-foreground mt-1">Daily & monthly shop expense tracking.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="w-4 h-4 mr-2" /> Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Electricity bill, etc." />
              </div>
              <div>
                <Label>Amount (₹)</Label>
                <Input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: +e.target.value })} />
              </div>
              <div>
                <Label>Payment Mode</Label>
                <Select value={form.paymentMode} onValueChange={(v) => setForm({ ...form, paymentMode: v as Expense["paymentMode"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="Bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={add}>Add Expense</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KPI label="Today's Expense" value={inr(todayTotal)} />
        <KPI label="This Month" value={inr(monthTotal)} />
        <KPI label="Total Records" value={expenses.length} />
      </div>

      <Card>
          <CardHeader>
            <CardTitle className="font-display">Records</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground py-8 text-center">Loading expenses...</p> : 
             byCategory.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {byCategory.map(([c, amt]) => (
                  <span key={c} className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs">
                    {c}: {inr(amt)}
                  </span>
                ))}
              </div>
            )}
            {sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No expenses recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2">Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Mode</th>
                    <th className="text-right">Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e) => (
                    <tr key={(e as any)._id || e.id} className="border-b last:border-0">
                      <td className="py-2">{formatDate(e.date)}</td>
                      <td>{e.category}</td>
                      <td>{e.description}</td>
                      <td>{e.paymentMode}</td>
                      <td className="text-right">{inr(e.amount)}</td>
                      <td className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => remove((e as any)._id || e.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
    </Layout>
  );
}

function KPI({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-display mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
