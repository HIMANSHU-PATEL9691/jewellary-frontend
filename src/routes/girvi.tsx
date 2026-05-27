import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { inr, type Girvi } from "@/lib/storage";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { girviAPI } from "@/lib/api";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function GirviPage() {
  const { data: girvis = [], isLoading } = useApi<Girvi[]>(["girvis"], () => girviAPI.getAll());
  const createMutation = useApiMutation((data: Girvi) => girviAPI.create(data), ["girvis"]);
  const updateMutation = useApiMutation((data: { id: string; body: Girvi }) => girviAPI.update(data.id, data.body), ["girvis"]);
  const deleteMutation = useApiMutation((id: string) => girviAPI.delete(id), ["girvis"]);

  const [filter, setFilter] = useState<"All" | Girvi["status"]>("All");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<Girvi, "id">>({
    date: new Date().toISOString().slice(0, 10),
    loanNo: `GL-${Date.now().toString().slice(-6)}`,
    customerName: "",
    customerMobile: "",
    customerMobile2: "",
    customerAddress: "",
    itemType: "Gold",
    itemCategory: "",
    itemDescription: "",
    grossWeight: 0,
    netWeight: 0,
    purity: "22K",
    marketValue: 0,
    loanAmount: 0,
    interestPct: 1.5,
    tenureMonths: 12,
    documentType: "Invoice",
    documentNumber: "",
    imageUrl: "",
    dueDate: "",
    status: "Active",
    note: "",
  });
  const [categories, setCategories] = useState(["Gold Jewellery", "Silver Jewellery", "Pendants", "Rings"]);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [imagePreview, setImagePreview] = useState("");

  const totals = useMemo(() => {
    const active = girvis.filter((g) => g.status === "Active");
    return {
      activeCount: active.length,
      principal: active.reduce((s, g) => s + g.loanAmount, 0),
      pledgedWeight: active.reduce((s, g) => s + g.netWeight, 0),
      collateralValue: active.reduce((s, g) => s + g.marketValue, 0),
    };
  }, [girvis]);

  const filtered = useMemo(() => {
    const list = filter === "All" ? girvis : girvis.filter((g) => g.status === filter);
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [girvis, filter]);

  async function add(createInvoice = false) {
    if (!form.customerName || !form.loanAmount) return;
    const dueDate = form.dueDate || (() => {
      const d = new Date(form.date);
      d.setMonth(d.getMonth() + form.tenureMonths);
      return d.toISOString().slice(0, 10);
    })();
    const payload: any = { ...form, dueDate };
    if (createInvoice) {
      payload.documentType = payload.documentType || "Invoice";
      payload.documentNumber = payload.documentNumber || `INV-${Date.now().toString().slice(-6)}`;
    }
    try {
      await createMutation.mutateAsync(payload);
      setForm({
        ...form,
        loanNo: `GL-${Date.now().toString().slice(-6)}`,
        customerName: "",
        customerMobile: "",
        customerMobile2: "",
        customerAddress: "",
        itemCategory: "",
        itemDescription: "",
        grossWeight: 0,
        netWeight: 0,
        marketValue: 0,
        loanAmount: 0,
        interestPct: 1.5,
        tenureMonths: 12,
        documentType: "Invoice",
        documentNumber: "",
        imageUrl: "",
        note: "",
      });
      setImagePreview("");
      if (createInvoice) {
        setOpen(false);
      }
    } catch (error) {
      console.error("[Girvi] Error saving to DB:", error);
    }
  }
  function addCategory() {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    setCategories((prev) => [...prev, trimmed]);
    setForm((prev) => ({ ...prev, itemCategory: trimmed }));
    setNewCategory("");
    setAddCategoryOpen(false);
  }
  function handleImageChange(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setForm((prev) => ({ ...prev, imageUrl: result }));
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  }

  async function setStatus(id: string, status: Girvi["status"]) {
    const g = girvis.find((x) => x.id === id || (x as any)._id === id);
    if (g) await updateMutation.mutateAsync({ id, body: { ...g, status } });
  }
  async function remove(id: string) {
    await deleteMutation.mutateAsync(id);
  }

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Girvi — Gold &amp; Silver Loans</h1>
          <p className="text-muted-foreground mt-1">
            Pledged item records, loan amount, interest and tenure.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="w-4 h-4 mr-2" /> New Girvi
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[75vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Girvi Loan</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Arrival Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <Label>Loan No.</Label>
                  <Input value={form.loanNo} onChange={(e) => setForm({ ...form, loanNo: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Customer Name</Label>
                  <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
                </div>
                <div>
                  <Label>Mobile</Label>
                  <Input value={form.customerMobile} onChange={(e) => setForm({ ...form, customerMobile: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Mobile 2</Label>
                  <Input value={form.customerMobile2} onChange={(e) => setForm({ ...form, customerMobile2: e.target.value })} />
                </div>
                <div>
                  <Label>Item Type</Label>
                  <Select value={form.itemType} onValueChange={(v) => setForm({ ...form, itemType: v as Girvi["itemType"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Gold">Gold</SelectItem>
                      <SelectItem value="Silver">Silver</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div>
                  <Label>Item Category</Label>
                  <Select value={form.itemCategory || ""} onValueChange={(v) => setForm({ ...form, itemCategory: v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem value={category} key={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="self-end">
                  <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="h-10">Add</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md max-h-[60vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add Category</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Category name" autoFocus />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setAddCategoryOpen(false)}>Cancel</Button>
                          <Button onClick={addCategory}>Save</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Textarea rows={2} value={form.customerAddress} onChange={(e) => setForm({ ...form, customerAddress: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea rows={2} value={form.itemDescription} onChange={(e) => setForm({ ...form, itemDescription: e.target.value })} placeholder="2 bangles, 1 chain..." />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Gross Weight (g)</Label>
                  <Input type="number" value={form.grossWeight || ""} onChange={(e) => setForm({ ...form, grossWeight: +e.target.value })} />
                </div>
                <div>
                  <Label>Net Weight (g)</Label>
                  <Input type="number" value={form.netWeight || ""} onChange={(e) => setForm({ ...form, netWeight: +e.target.value })} />
                </div>
                <div>
                  <Label>Purity</Label>
                  <Input value={form.purity} onChange={(e) => setForm({ ...form, purity: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Loan Amount</Label>
                  <Input type="number" value={form.loanAmount || ""} onChange={(e) => setForm({ ...form, loanAmount: +e.target.value })} />
                </div>
                <div>
                  <Label>Interest %</Label>
                  <Input type="number" step="0.1" value={form.interestPct || ""} onChange={(e) => setForm({ ...form, interestPct: +e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tenure (months)</Label>
                  <Input type="number" value={form.tenureMonths || ""} onChange={(e) => setForm({ ...form, tenureMonths: +e.target.value })} />
                </div>
                <div>
                  <Label>Bill / Invoice Type</Label>
                  <Select value={form.documentType || "Invoice"} onValueChange={(v) => setForm({ ...form, documentType: v as Girvi["documentType"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Invoice">Invoice</SelectItem>
                      <SelectItem value="Bill">Bill</SelectItem>
                      <SelectItem value="Receipt">Receipt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Bill / Invoice No.</Label>
                <Input value={form.documentNumber || ""} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} placeholder="INV-12345" />
              </div>
              <div>
                <Label>Item Image</Label>
                <Input type="file" accept="image/*" onChange={(e) => handleImageChange(e.target.files?.[0])} />
                {imagePreview && <img src={imagePreview} alt="Item" className="mt-2 h-28 w-full rounded-md object-cover" />}
              </div>
              <div>
                <Label>Note</Label>
                <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Button className="w-full" onClick={() => add(false)}>Save Girvi</Button>
                <Button className="w-full" onClick={() => add(true)}>Save & Create Invoice</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPI label="Active Loans" value={totals.activeCount} />
        <KPI label="Principal Out" value={inr(totals.principal)} />
        <KPI label="Pledged Weight" value={`${totals.pledgedWeight.toFixed(3)} g`} />
        <KPI label="Collateral Value" value={inr(totals.collateralValue)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">New Girvi</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use the <strong>New Girvi</strong> button in the header to open the loan form in a dialog.
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-display">Loan Records</CardTitle>
              <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                  <SelectItem value="Auctioned">Auctioned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground py-8 text-center">Loading records...</p> : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No girvi records.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b">
                    <tr>
                      <th className="py-2">Loan No.</th>
                      <th>Customer</th>
                      <th>Item</th>
                      <th className="text-right">Net Wt.</th>
                      <th className="text-right">Loan</th>
                      <th className="text-right">Int.</th>
                      <th>Due</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((g) => (
                      <tr key={(g as any)._id || g.id} className="border-b last:border-0 align-top hover:bg-muted/40">
                        <td className="py-2">
                          <div className="font-medium">{g.loanNo}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(g.date)}</div>
                        </td>
                        <td>
                          <div className="font-medium">{g.customerName}</div>
                          <div className="text-xs text-muted-foreground">{g.customerMobile}</div>
                        </td>
                        <td>
                          <div>{g.itemType} {g.purity}</div>
                          <div className="text-xs text-muted-foreground">{g.itemDescription}</div>
                        </td>
                        <td className="text-right">{g.netWeight.toFixed(3)} g</td>
                        <td className="text-right">{inr(g.loanAmount)}</td>
                        <td className="text-right">{g.interestPct}%/mo</td>
                        <td>{g.dueDate ? formatDate(g.dueDate) : "—"}</td>
                        <td>
                          <Select value={g.status} onValueChange={(v) => setStatus((g as any)._id || g.id, v as Girvi["status"])}>
                            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Active">Active</SelectItem>
                              <SelectItem value="Closed">Closed</SelectItem>
                              <SelectItem value="Auctioned">Auctioned</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => remove((g as any)._id || g.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
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
