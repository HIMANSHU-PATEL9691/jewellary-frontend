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
import { girviAPI, customerAPI } from "@/lib/api";
import { useMemo, useState } from "react";
import { Plus, Trash2, Printer, Pencil } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

function calculateInterest(girvi: Girvi) {
  if (!girvi.date) return 0;
  
  const start = new Date(girvi.date);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const diffTime = now.getTime() > start.getTime() ? now.getTime() - start.getTime() : 0;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  // Exact fractional months (e.g., 45 days = 1.5 months). Minimum 1 month charge.
  const months = Math.max(1, diffDays / 30); 
  return Math.round((girvi.loanAmount * (girvi.interestPct / 100)) * months);
}

function calculateForwardedInterest(girvi: Girvi) {
  if (!girvi.date || !girvi.forwardedAmount || !girvi.forwardedInterestPct) return 0;
  
  const start = new Date(girvi.date);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const diffTime = now.getTime() > start.getTime() ? now.getTime() - start.getTime() : 0;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  const months = Math.max(1, diffDays / 30); 
  return Math.round((girvi.forwardedAmount * (girvi.forwardedInterestPct / 100)) * months);
}

export default function GirviPage() {
  const { data: girvis = [], isLoading } = useApi<Girvi[]>(["girvis"], () => girviAPI.getAll());
  const { data: customers = [] } = useApi<any[]>(["customers"], () => customerAPI.getAll());
  const createMutation = useApiMutation((data: Girvi) => girviAPI.create(data), ["girvis"]);
  const updateMutation = useApiMutation((data: { id: string; body: Girvi }) => girviAPI.update(data.id, data.body), ["girvis"]);
  const deleteMutation = useApiMutation((id: string) => girviAPI.delete(id), ["girvis"]);

  const [filter, setFilter] = useState<"All" | Girvi["status"]>("All");
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Girvi | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchCust, setSearchCust] = useState("");
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
    forwardedTo: "",
    forwardedShopName: "",
    forwardedShopGstNo: "",
    forwardedShopAddress: "",
    forwardedAmount: 0,
    forwardedInterestPct: 0,
    forwardedImageUrl: "",
  });
  const [categories, setCategories] = useState(["Gold Jewellery", "Silver Jewellery", "Pendants", "Rings"]);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [forwardedImagePreview, setForwardedImagePreview] = useState("");

  const totals = useMemo(() => {
    const active = girvis.filter((g) => g.status === "Active");
    const forwarded = active.filter(g => (g.forwardedAmount || 0) > 0);
    return {
      activeCount: active.length,
      principal: active.reduce((s, g) => s + g.loanAmount, 0),
      pledgedWeight: active.reduce((s, g) => s + g.netWeight, 0),
      collateralValue: active.reduce((s, g) => s + g.marketValue, 0),
      forwardedPrincipal: forwarded.reduce((s, g) => s + (g.forwardedAmount || 0), 0),
      forwardedInterest: forwarded.reduce((s, g) => s + calculateForwardedInterest(g), 0),
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
      payload.documentType = payload.documentType || "Bill";
      payload.documentNumber = payload.documentNumber || `GRV-${Date.now().toString().slice(-6)}`;
    }
    try {
      let saved;
      if (editingId) {
        saved = await updateMutation.mutateAsync({ id: editingId, body: payload });
        toast.success("Girvi loan updated successfully!");
      } else {
        saved = await createMutation.mutateAsync(payload);
        toast.success("Girvi loan saved successfully!");
      }
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
        forwardedTo: "",
        forwardedShopName: "",
        forwardedShopGstNo: "",
        forwardedShopAddress: "",
        forwardedAmount: 0,
        forwardedInterestPct: 0,
        forwardedImageUrl: "",
      });
      setImagePreview("");
      setForwardedImagePreview("");
      setEditingId(null);
      if (createInvoice) {
        setOpen(false);
        setViewing(saved);
      }
    } catch (error) {
      console.error("[Girvi] Error saving to DB:", error);
      toast.error("Failed to connect to backend server. Is it running?");
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
  function handleForwardedImageChange(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setForm((prev) => ({ ...prev, forwardedImageUrl: result }));
      setForwardedImagePreview(result);
    };
    reader.readAsDataURL(file);
  }

  async function setStatus(id: string, status: Girvi["status"]) {
    const g = girvis.find((x) => x.id === id || (x as any)._id === id);
    if (status === "Closed" && g) {
      const interest = calculateInterest(g);
      const total = g.loanAmount + interest;
      const confirmed = window.confirm(`Are you sure you want to close this loan?\n\nPrincipal: ${inr(g.loanAmount)}\nAccrued Interest: ${inr(interest)}\nTotal to Collect: ${inr(total)}\n\nIs the full amount cleared?`);
      if (!confirmed) return;
    }
    if (g) await updateMutation.mutateAsync({ id, body: { ...g, status } });
  }
  async function remove(id: string) {
    await deleteMutation.mutateAsync(id);
  }

  const startNew = () => {
    setEditingId(null);
    setForm({
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
      forwardedTo: "",
      forwardedShopName: "",
      forwardedShopGstNo: "",
      forwardedShopAddress: "",
      forwardedAmount: 0,
      forwardedInterestPct: 0,
      forwardedImageUrl: "",
    });
    setImagePreview("");
    setForwardedImagePreview("");
    setSearchCust("");
  };

  const startEdit = (g: Girvi) => {
    setEditingId((g as any)._id || g.id);
    setForm({
      ...g,
      date: g.date ? new Date(g.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      dueDate: g.dueDate ? new Date(g.dueDate).toISOString().slice(0, 10) : "",
    });
    setImagePreview(g.imageUrl || "");
    setForwardedImagePreview(g.forwardedImageUrl || "");
    setOpen(true);
  };

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
            <Button size="lg" onClick={startNew}>
              <Plus className="w-4 h-4 mr-2" /> New Girvi
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[75vh] overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Girvi Loan" : "New Girvi Loan"}</DialogTitle>
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
                  <Label className="text-xs">Search Customer</Label>
                  <Input 
                    placeholder="Search name or mobile..." 
                    value={searchCust} 
                    onChange={(e) => {
                      setSearchCust(e.target.value);
                      const match = customers.find(c => c.mobile === e.target.value || c.phone === e.target.value || c.name.toLowerCase() === e.target.value.toLowerCase());
                      if (match) setForm({...form, customerName: match.name, customerMobile: match.mobile || match.phone || "", customerMobile2: match.phone2 || "", customerAddress: match.address || ""});
                    }} 
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer *</Label>
                  <Select value={form.customerMobile || ""} onValueChange={(val) => {
                    const match = customers.find(c => (c.mobile || c.phone) === val);
                    if (match) setForm({...form, customerName: match.name, customerMobile: match.mobile || match.phone || "", customerMobile2: match.phone2 || "", customerAddress: match.address || ""});
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.filter(c => c.name.toLowerCase().includes(searchCust.toLowerCase()) || (c.mobile || c.phone || "").includes(searchCust)).map((c) => (
                        <SelectItem key={c.mobile || c.phone} value={c.mobile || c.phone}>{c.name} · {c.mobile || c.phone}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Customer Name</Label>
                  <Input value={form.customerName} readOnly className="bg-muted" />
                </div>
                <div>
                  <Label>Mobile</Label>
                  <Input value={form.customerMobile} readOnly className="bg-muted" />
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
                    <DialogContent className="max-w-md max-h-[60vh] overflow-y-auto" aria-describedby={undefined}>
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
                <Textarea rows={2} value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
              
              <div className="border-t pt-4 mt-2">
                <h3 className="text-sm font-medium mb-3 text-purple-700">Forwarding Details (Optional)</h3>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <Label>Shop Name</Label>
                    <Input value={form.forwardedShopName || ""} onChange={(e) => setForm({ ...form, forwardedShopName: e.target.value })} placeholder="Shop Name" />
                  </div>
                  <div>
                    <Label>Shop GST No.</Label>
                    <Input value={form.forwardedShopGstNo || ""} onChange={(e) => setForm({ ...form, forwardedShopGstNo: e.target.value })} placeholder="GSTIN" />
                  </div>
                </div>
                <div className="mb-2">
                  <Label>Shop Address</Label>
                  <Textarea rows={2} value={form.forwardedShopAddress || ""} onChange={(e) => setForm({ ...form, forwardedShopAddress: e.target.value })} placeholder="Address" />
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <Label>Forwarded Amount ₹</Label>
                    <Input type="number" value={form.forwardedAmount || ""} onChange={(e) => setForm({ ...form, forwardedAmount: +e.target.value })} />
                  </div>
                  <div>
                    <Label>Shop Interest %</Label>
                    <Input type="number" step="0.1" value={form.forwardedInterestPct || ""} onChange={(e) => setForm({ ...form, forwardedInterestPct: +e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Forwarded Item Image</Label>
                  <Input type="file" accept="image/*" onChange={(e) => handleForwardedImageChange(e.target.files?.[0])} />
                  {forwardedImagePreview && <img src={forwardedImagePreview} alt="Forwarded Item" className="mt-2 h-28 w-full rounded-md object-cover" />}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 pt-2">
                <Button className="w-full" onClick={() => add(false)}>Save Girvi</Button>
                <Button className="w-full" onClick={() => add(true)}>Save & Print Bill</Button>
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
        {totals.forwardedPrincipal > 0 && (
          <>
            <KPI label="Forwarded Principal" value={inr(totals.forwardedPrincipal)} />
            <KPI label="Shop Interest Due" value={inr(totals.forwardedInterest)} />
            <KPI label="Total Shop Payable" value={inr(totals.forwardedPrincipal + totals.forwardedInterest)} />
          </>
        )}
      </div>

      <Card>
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
                  <thead className="text-left text-muted-foreground border-b bg-muted/20">
                    <tr>
                      <th className="py-3 px-4 font-medium">Loan No</th>
                      <th className="py-3 font-medium">Date</th>
                      <th className="py-3 font-medium">Customer</th>
                      <th className="py-3 font-medium">Item Details</th>
                      <th className="py-3 font-medium text-right">Net Wt.</th>
                      <th className="py-3 font-medium text-right">Principal</th>
                      <th className="py-3 font-medium text-right">Interest</th>
                      <th className="py-3 font-medium px-2">Status</th>
                      <th className="py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((g) => {
                      const interestAmt = calculateInterest(g);
                      const statusColors = {
                        Active: "bg-amber-50 text-amber-700 border-amber-200",
                        Closed: "bg-green-50 text-green-700 border-green-200",
                        Auctioned: "bg-rose-50 text-rose-700 border-rose-200",
                      };
                      
                      return (
                        <tr key={(g as any)._id || g.id} className="border-b last:border-0 align-top hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4 font-medium text-primary whitespace-nowrap">{g.loanNo}</td>
                          <td className="py-3 whitespace-nowrap">
                            <div>{formatDate(g.date)}</div>
                            {g.dueDate && <div className="text-[10px] text-rose-500 mt-0.5">Due: {formatDate(g.dueDate)}</div>}
                          </td>
                          <td className="py-3">
                            <div className="font-medium whitespace-nowrap">{g.customerName}</div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">{g.customerMobile}</div>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              {g.imageUrl ? (
                                <img src={g.imageUrl} alt="Item" className="w-8 h-8 rounded object-cover border border-border shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center border border-border shrink-0 text-[10px] text-muted-foreground">No img</div>
                              )}
                              <div>
                                <div className="font-medium whitespace-nowrap">{g.itemType} {g.purity}</div>
                                <div className="text-xs text-muted-foreground line-clamp-1 max-w-[150px]" title={g.itemDescription}>{g.itemDescription}</div>
                              {(g.forwardedShopName || g.forwardedTo) && <div className="mt-1 text-[10px] font-semibold text-purple-700 border border-purple-200 bg-purple-50 inline-block px-1.5 py-0.5 rounded truncate max-w-35" title={g.forwardedShopName || g.forwardedTo}>Fwd: {g.forwardedShopName || g.forwardedTo}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-right font-medium whitespace-nowrap">{g.netWeight.toFixed(3)} g</td>
                          <td className="py-3 text-right font-medium whitespace-nowrap">{inr(g.loanAmount)}</td>
                          <td className="py-3 text-right whitespace-nowrap">
                            <div className="font-medium text-amber-600">{inr(interestAmt)}</div>
                            <div className="text-[10px] text-muted-foreground">@ {g.interestPct}%/mo</div>
                          </td>
                          <td className="py-3 px-2">
                            <Select value={g.status} onValueChange={(v) => setStatus((g as any)._id || g.id, v as Girvi["status"])}>
                              <SelectTrigger className={`h-8 w-28 text-xs font-medium ${statusColors[g.status] || ""}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Closed">Closed</SelectItem>
                                <SelectItem value="Auctioned">Auctioned</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setViewing(g as Girvi)}>View</Button>
                              <Button variant="ghost" size="icon" onClick={() => startEdit(g as Girvi)}>
                                <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => remove((g as any)._id || g.id)}>
                                <Trash2 className="w-4 h-4 text-rose-500 hover:text-rose-600" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      {viewing && <GirviModal girvi={viewing} onClose={() => setViewing(null)} />}
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

function GirviModal({ girvi, onClose }: { girvi: Girvi; onClose: () => void }) {
  const interest = calculateInterest(girvi);
  const total = girvi.loanAmount + interest;
  const forwardedInterest = calculateForwardedInterest(girvi);
  const forwardedTotal = (girvi.forwardedAmount || 0) + forwardedInterest;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-start p-2 sm:p-4 print:bg-white print:p-0 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-lg shadow-xl print:shadow-none print:max-w-none text-slate-900 my-auto relative">
        <div className="p-5 border-2 border-slate-800 m-2 print:m-0 rounded-sm bg-white">
          {/* Header */}
          <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
            <h2 className="text-2xl font-display font-bold uppercase tracking-wider">Cloudiefy Jewellery</h2>
            <p className="text-xs text-slate-600 font-medium tracking-widest mt-1">GIRVI / PAWN TICKET</p>
          </div>
          
          {/* Meta Info */}
          <div className="flex justify-between items-end mb-4 text-xs">
            <div>
              <div className="font-bold text-lg">{girvi.loanNo}</div>
              <div className="text-slate-600 mt-1">
                Status: <span className="uppercase font-bold text-slate-900">{girvi.status}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 text-left">
                <span className="text-slate-500 font-medium text-right">Date:</span>
                <span className="font-bold">{formatDate(girvi.date)}</span>
                {girvi.dueDate && (
                  <>
                    <span className="text-slate-500 font-medium text-right">Due Date:</span>
                    <span className="font-bold">{formatDate(girvi.dueDate)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Customer Info Box */}
          <div className="border border-slate-300 rounded p-3 mb-4">
            <h3 className="font-bold text-xs uppercase text-slate-500 mb-3 tracking-wider">Customer Details</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="font-bold text-base mb-1">{girvi.customerName}</div>
                <div>{girvi.customerMobile} {girvi.customerMobile2 ? `/ ${girvi.customerMobile2}` : ""}</div>
                <div className="text-slate-600 mt-1">{girvi.customerAddress || "No address provided"}</div>
              </div>
              <div className="text-right flex flex-col justify-end">
                {girvi.documentType && <div><span className="text-slate-500">ID Type:</span> <span className="font-medium">{girvi.documentType}</span></div>}
                {girvi.documentNumber && <div><span className="text-slate-500">ID No:</span> <span className="font-medium">{girvi.documentNumber}</span></div>}
              </div>
            </div>
          </div>

          {/* Item Details Table */}
          <div className="mb-4">
            <h3 className="font-bold text-xs uppercase text-slate-500 mb-3 tracking-wider">Pledged Item Details</h3>
            <table className="w-full text-xs border-collapse border border-slate-300">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border border-slate-300 p-1.5 text-left font-semibold">Description</th>
                  <th className="border border-slate-300 p-1.5 text-left font-semibold">Type</th>
                  <th className="border border-slate-300 p-1.5 text-right font-semibold">Gross Wt</th>
                  <th className="border border-slate-300 p-1.5 text-right font-semibold">Net Wt</th>
                  <th className="border border-slate-300 p-1.5 text-right font-semibold">Purity</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-300 p-1.5">{girvi.itemDescription}</td>
                  <td className="border border-slate-300 p-1.5">{girvi.itemType} {girvi.itemCategory ? `- ${girvi.itemCategory}` : ""}</td>
                  <td className="border border-slate-300 p-1.5 text-right">{girvi.grossWeight}g</td>
                  <td className="border border-slate-300 p-1.5 text-right font-bold">{girvi.netWeight}g</td>
                  <td className="border border-slate-300 p-1.5 text-right">{girvi.purity}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Financials Box */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="border border-slate-300 rounded p-3 text-xs flex flex-col justify-center">
              <div className="flex justify-between mb-2">
                <span className="text-slate-500">Interest Rate</span>
                <span className="font-bold">{girvi.interestPct}% / month</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-slate-500">Loan Tenure</span>
                <span className="font-bold">{girvi.tenureMonths} months</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Est. Market Value</span>
                <span className="font-bold">{inr(girvi.marketValue)}</span>
              </div>
              {girvi.status === "Closed" && (
                <div className="mt-3 p-2 bg-green-50 border border-green-200 text-green-800 text-center font-bold rounded tracking-wide">
                  LOAN CLOSED & CLEARED
                </div>
              )}
            </div>

            <div className="border border-slate-300 rounded p-3 text-xs bg-slate-50">
              <div className="flex justify-between mb-1.5 text-sm">
                <span className="text-slate-600">Principal Amount</span>
                <span className="font-bold">{inr(girvi.loanAmount)}</span>
              </div>
              {girvi.status !== "Closed" && (
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-slate-600">Accrued Interest</span>
                  <span className="font-bold">{inr(interest)}</span>
                </div>
              )}
              <div className="border-t border-slate-300 mt-1.5 pt-2 flex justify-between font-bold text-lg">
                <span>{girvi.status === "Closed" ? "Balance Due" : "Total Payable"}</span>
                <span className={girvi.status === "Closed" ? "text-green-700" : "text-rose-700"}>
                  {girvi.status === "Closed" ? inr(0) : inr(total)}
                </span>
              </div>
            </div>
          </div>

          {/* Note and Images */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              {girvi.note && (
                <div className="text-xs">
                  <strong className="text-xs uppercase text-slate-500 mb-1 block tracking-wider">Remarks / Note</strong>
                  <p className="p-2 border border-slate-200 bg-slate-50 rounded text-slate-700">{girvi.note}</p>
                </div>
              )}
            </div>
            <div className="text-right flex justify-end">
              {girvi.imageUrl && (
                <div className="text-xs">
                   <strong className="text-xs uppercase text-slate-500 mb-1 block tracking-wider">Pledged Item</strong>
                   <img src={girvi.imageUrl} alt="Pledged Item" className="w-20 h-20 object-cover rounded border border-slate-300 shadow-sm ml-auto" />
                </div>
              )}
            </div>
          </div>

          {/* Forwarding Details (Hidden from print) */}
          {(girvi.forwardedShopName || girvi.forwardedTo) && (
            <div className="mb-4 p-3 border border-purple-200 bg-purple-50 rounded text-xs print:hidden">
              <h4 className="font-bold mb-3 uppercase tracking-wider text-purple-900 flex items-center gap-2">
                <span className="bg-purple-200 text-purple-900 px-2 py-0.5 rounded">Internal Use Only</span> 
                Forwarding Details
              </h4>
              <div className="grid grid-cols-3 gap-4 text-purple-900">
                <div>
                  <div className="text-purple-600/80 mb-0.5">Shop / Location</div>
                  <div className="font-bold text-sm">{girvi.forwardedShopName || girvi.forwardedTo}</div>
                  <div>{girvi.forwardedShopAddress}</div>
                  <div>{girvi.forwardedShopGstNo && `GST: ${girvi.forwardedShopGstNo}`}</div>
                </div>
                <div>
                  <div className="text-purple-600/80 mb-0.5">Shop Financials</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    <span>Principal:</span> <span className="font-bold">{inr(girvi.forwardedAmount || 0)}</span>
                    <span>Rate:</span> <span className="font-bold">{girvi.forwardedInterestPct || 0}%/mo</span>
                    <span>Interest:</span> <span className="font-bold text-amber-700">{inr(forwardedInterest)}</span>
                    <span className="font-bold pt-1 border-t border-purple-200">Total Owed:</span> <span className="font-bold text-rose-700 pt-1 border-t border-purple-200">{inr(forwardedTotal)}</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  {girvi.forwardedImageUrl && (
                    <img src={girvi.forwardedImageUrl} alt="Forwarded" className="w-20 h-20 object-cover rounded border border-purple-300" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Signatures */}
          <div className="mt-12 flex justify-between items-end text-xs font-bold text-slate-700 uppercase tracking-wider">
            <div className="text-center">
              <div className="w-56 border-t-2 border-slate-400 mb-2"></div>
              Customer Signature
            </div>
            <div className="text-center">
              <div className="w-56 border-t-2 border-slate-400 mb-2"></div>
              Authorized Signatory
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-slate-100 p-4 border-t border-slate-200 rounded-b-lg flex justify-end gap-3 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}
