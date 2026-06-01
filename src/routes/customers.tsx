import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Plus, Trash2, Pencil, Search, Loader2, Eye, Receipt, Wallet, ShoppingBag, UserCheck, Wrench } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { customerAPI, invoicesAPI, ordersAPI, girviAPI, repairsAPI } from "@/lib/api";
import { inr, type Invoice, type Order, type Girvi, type Repair } from "@/lib/storage";
import { toast } from "sonner";

interface Customer {
  _id?: string;
  id?: string;
  name: string;
  phone: string;
  phone2?: string;
  address: string;
  gstNumber?: string;
  pan?: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

const empty: Customer = {
  name: "",
  phone: "",
  phone2: "",
  address: "",
  gstNumber: "",
  pan: "",
  notes: "",
};

const defaultManualDue = {
  customerId: "NEW",
  customerName: "",
  phone: "",
  phone2: "",
  address: "",
  gstNumber: "",
  pan: "",
  notes: "",
  itemName: "",
  purity: "22K",
  netWeight: "" as number | "",
  ratePerGram: "" as number | "",
  makingCharge: "" as number | "",
  totalValue: "" as number | "",
  dueAmount: "" as number | "",
};

export default function CustomersPage() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Customer>(empty);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Fetch customers
  const { data: customers = [], isLoading, error } = useApi(
    ["customers"],
    () => customerAPI.getAll()
  );

  const { data: invoices = [] } = useApi<Invoice[]>(["invoices"], () => invoicesAPI.getAll());
  const { data: orders = [] } = useApi<Order[]>(["orders"], () => ordersAPI.getAll());
  const { data: girvis = [] } = useApi<Girvi[]>(["girvis"], () => girviAPI.getAll());
  const { data: repairs = [] } = useApi<Repair[]>(["repairs"], () => repairsAPI.getAll());

  const createInvoiceMutation = useApiMutation(
    (data: any) => invoicesAPI.create(data),
    ["invoices"]
  );

  // Create mutation
  const createMutation = useApiMutation(
    (data: Customer) => customerAPI.create(data),
    ["customers"]
  );

  // Update mutation
  const updateMutation = useApiMutation(
    (data: { id: string; body: Customer }) => customerAPI.update(data.id, data.body),
    ["customers"]
  );

  // Delete mutation
  const deleteMutation = useApiMutation(
    (id: string) => customerAPI.delete(id),
    ["customers"]
  );

  // Update Invoice mutation
  const updateInvoiceMutation = useApiMutation(
    (data: { id: string; body: Partial<Invoice> }) => invoicesAPI.update(data.id, data.body),
    ["invoices"]
  );

  // Update Order mutation
  const updateOrderMutation = useApiMutation(
    (data: { id: string; body: Partial<Order> }) => ordersAPI.update(data.id, data.body),
    ["orders"]
  );
  // Update Repair mutation
  const updateRepairMutation = useApiMutation(
    (data: { id: string; body: Partial<Repair> }) => repairsAPI.update(data.id, data.body),
    ["repairs"]
  );

  const filtered = customers.filter(
    (c: Customer) =>
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.phone.includes(q) ||
      (c.phone2 && c.phone2.includes(q))
  );

  const startNew = () => {
    setEditingId(null);
    setDraft({ ...empty });
    setOpen(true);
  };

  const startEdit = (c: Customer) => {
    setEditingId(c._id || null);
    setDraft(c);
    setOpen(true);
  };

  const save = async () => {
    console.log("[Frontend Component] Attempting to save customer draft:", draft);
    if (!draft.name || !draft.phone) {
      toast.error("Name and phone are required");
      return;
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          body: draft,
        });
        toast.success("Customer updated successfully");
      } else {
        await createMutation.mutateAsync(draft);
        toast.success("Customer created successfully");
      }
      setOpen(false);
      setDraft(empty);
      setEditingId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to save customer");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Customer deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete customer");
    }
  };

  const set = <K extends keyof Customer>(k: K, v: Customer[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const isLoading_UI = isLoading || createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const selectedCustomer = customers.find((c: Customer) => c._id === profileId);
  
  const custInvoices = invoices.filter(i => i.customerId === profileId || i.customerMobile === selectedCustomer?.phone);
  const custOrders = orders.filter(o => o.customerMobile === selectedCustomer?.phone);
  const custGirvis = girvis.filter(g => g.customerMobile === selectedCustomer?.phone || g.customerMobile2 === selectedCustomer?.phone);
  const custRepairs = repairs.filter(r => r.customerMobile === selectedCustomer?.phone);

  const totalSales = custInvoices.filter(i => !i.number?.startsWith("MAN-")).reduce((s, i) => s + i.total, 0);
  const totalPaid = custInvoices.reduce((s, i) => s + (i.amountPaid !== undefined ? i.amountPaid : i.total), 0);
  const totalDue = custInvoices.reduce((s, i) => s + (i.balanceDue || 0), 0);

  const [payModal, setPayModal] = useState<{ type: 'invoice'|'order'|'repair', item: any, due: number } | null>(null);
  const [payAmount, setPayAmount] = useState<number | "">("");
  const [payMode, setPayMode] = useState("Cash");
  const [payNote, setPayNote] = useState("");

  const [manualDueOpen, setManualDueOpen] = useState(false);
  const [manualDue, setManualDue] = useState(defaultManualDue);

  const saveManualDue = async () => {
    if (!manualDue.itemName || manualDue.totalValue === "" || manualDue.dueAmount === "") {
      toast.error("Please fill required fields (Item Name, Total, Due)");
      return;
    }
    
    let cid = manualDue.customerId;
    let cName = manualDue.customerName;
    let cPhone = manualDue.phone;

    if (!cid || cid === "NEW") {
      if (!cName || !cPhone) {
         toast.error("Customer name and phone are required for a new customer");
         return;
      }
      try {
        const newCust = await createMutation.mutateAsync({
          name: cName,
          phone: cPhone,
          phone2: manualDue.phone2,
          address: manualDue.address,
          gstNumber: manualDue.gstNumber,
          pan: manualDue.pan,
          notes: manualDue.notes,
        } as Customer);
        cid = newCust._id || newCust.id || "";
      } catch (e: any) {
        toast.error("Failed to create customer: " + (e.message || "Unknown error"));
        return;
      }
    }

    const total = Number(manualDue.totalValue);
    const due = Number(manualDue.dueAmount);
    const paid = total - due;

    const inv: any = {
      number: "MAN-" + Date.now().toString().slice(-6),
      type: "NON-GST",
      customerId: cid,
      customerName: cName,
      customerMobile: cPhone,
      items: [{ productId: "manual", name: `Manual Due: ${manualDue.itemName}`, purity: manualDue.purity || "-", netWeight: Number(manualDue.netWeight) || 0, ratePerGram: Number(manualDue.ratePerGram) || 0, makingCharge: Number(manualDue.makingCharge) || 0, stoneCharge: 0, makingChargePct: 0, gstPct: 0, qty: 1 }],
      discount: 0,
      oldGoldAmount: 0,
      paymentMode: "Cash",
      subtotal: total,
      gstAmount: 0,
      total: total,
      amountPaid: paid,
      balanceDue: due,
      payments: paid > 0 ? [{ date: new Date().toISOString(), amount: paid, mode: "Cash", note: "Initial Partial Payment" }] : [],
    };
    try {
      await createInvoiceMutation.mutateAsync(inv);
      toast.success("Manual due added successfully");
      setManualDueOpen(false);
      setManualDue(defaultManualDue);
    } catch (e) {
      toast.error("Failed to add manual due");
    }
  };

  const openPayModal = (type: 'invoice'|'order'|'repair', item: any, due: number) => {
    setPayModal({ type, item, due });
    setPayAmount(due);
    setPayMode("Cash");
    setPayNote("");
  };

  const submitPayment = async () => {
    if (!payModal || !payAmount || payAmount <= 0) return;
    const amt = Number(payAmount);

    try {
      if (payModal.type === 'invoice') {
        const inv = payModal.item as Invoice;
        const newPaid = (inv.amountPaid || 0) + amt;
        const newDue = Math.max(0, (inv.balanceDue || 0) - amt);
        const newPayment = { date: new Date().toISOString(), amount: amt, mode: payMode, note: payNote };
        const updatedPayments = [...(inv.payments || []), newPayment];
        await updateInvoiceMutation.mutateAsync({
          id: inv._id || inv.id,
          body: { ...inv, amountPaid: newPaid, balanceDue: newDue, payments: updatedPayments } as Partial<Invoice>
        });
      } else if (payModal.type === 'order') {
        const ord = payModal.item as Order;
        const newPaid = (ord.advancePaid || 0) + amt;
        await updateOrderMutation.mutateAsync({
          id: ord._id || ord.id,
          body: { ...ord, advancePaid: newPaid } as Partial<Order>
        });
      } else if (payModal.type === 'repair') {
        const rep = payModal.item as Repair;
        const newPaid = (rep.advance || 0) + amt;
        await updateRepairMutation.mutateAsync({
          id: rep._id || rep.id || "",
          body: { ...rep, advance: newPaid } as Partial<Repair>
        });
      }
      toast.success("Payment recorded successfully!");
      setPayModal(null);
    } catch (e) {
      toast.error("Failed to record payment");
    }
  };

  const allPayments = custInvoices
    .flatMap(inv => {
      const pmts = [...(inv.payments || [])];
      const hasInitial = pmts.some(p => p.note === "Initial Payment");
      if (!hasInitial) {
        const subsequentSum = pmts.reduce((s, p) => s + p.amount, 0);
        const totalPaid = inv.amountPaid !== undefined ? inv.amountPaid : inv.total;
        const initialAmt = totalPaid - subsequentSum;
        if (initialAmt > 0) {
          pmts.push({
            date: inv.createdAt,
            amount: initialAmt,
            mode: inv.paymentMode,
            note: "Initial Payment"
          });
        }
      }
      return pmts.map(p => ({ ...p, invoiceNo: inv.number }));
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const groupedPayments = allPayments.reduce((acc, p) => {
    if (!acc[p.invoiceNo]) acc[p.invoiceNo] = [];
    acc[p.invoiceNo].push(p);
    return acc;
  }, {} as Record<string, typeof allPayments>);

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Customers</h1>
          <p className="text-muted-foreground mt-1">{customers.length} on file.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={() => {
            setManualDue(defaultManualDue);
            setManualDueOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-2" /> Manual Due
          </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" onClick={startNew} disabled={isLoading_UI}>
              <Plus className="w-4 h-4 mr-2" /> Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[75vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                {editingId ? "Edit" : "New"} customer
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <F label="Customer Name *">
                <Input
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Customer name"
                />
              </F>
              <F label="Mobile No *">
                <Input
                  value={draft.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="Primary mobile number"
                />
              </F>
              <F label="Mobile No 2 (optional)">
                <Input
                  value={draft.phone2 || ""}
                  onChange={(e) => set("phone2", e.target.value)}
                  placeholder="Secondary mobile number"
                />
              </F>
              <F label="Address (optional)">
                <Input
                  value={draft.address || ""}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Full address"
                />
              </F>
              <F label="GST No (optional)">
                <Input
                  value={draft.gstNumber || ""}
                  onChange={(e) => set("gstNumber", e.target.value)}
                  placeholder="GSTIN"
                />
              </F>
              <F label="PAN No (optional)">
                <Input
                  value={draft.pan || ""}
                  onChange={(e) => set("pan", e.target.value)}
                  placeholder="PAN number"
                />
              </F>
              <F label="Notes (optional)">
                <Input
                  value={draft.notes || ""}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Additional notes"
                />
              </F>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading_UI}>
                Cancel
              </Button>
              <Button onClick={save} disabled={isLoading_UI || !draft.name || !draft.phone}>
                {isLoading_UI ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </header>

      <div className="relative mb-4 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Loading customers...</p>
          ) : error ? (
            <p className="text-sm text-red-500 py-12 text-center">Failed to load customers</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No customers yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="p-3">Name</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>GST No</th>
                  <th>PAN No</th>
                  <th>Added</th>
                  <th className="text-right pr-4">Due Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: Customer) => {
                  const custDue = invoices
                    .filter((i) => i.customerId === c._id || i.customerMobile === c.phone)
                    .reduce((sum, i) => sum + (i.balanceDue || 0), 0);

                  return (
                    <tr key={c._id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td>
                      <div>{c.phone}</div>
                      {c.phone2 && <div className="text-xs text-muted-foreground">{c.phone2}</div>}
                    </td>
                    <td className="text-muted-foreground">{c.address || "—"}</td>
                    <td className="text-muted-foreground">{c.gstNumber || "—"}</td>
                    <td className="text-muted-foreground">{c.pan || "—"}</td>
                    <td className="text-muted-foreground">
                      {c.createdAt ? formatDate(c.createdAt) : "—"}
                    </td>
                    <td className="text-right pr-4 font-medium text-rose-600">
                      {custDue > 0 ? inr(custDue) : "—"}
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end pr-3">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setProfileId(c._id || null)}
                          title="View Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEdit(c)}
                          disabled={isLoading_UI}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => remove(c._id || "")}
                          disabled={isLoading_UI}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Customer Profile Dialog */}
      <Dialog open={!!profileId} onOpenChange={(val) => !val && setProfileId(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          {selectedCustomer && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-display flex items-center gap-2">
                  <UserCheck className="w-6 h-6 text-primary" />
                  {selectedCustomer.name}'s Profile
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                {/* Contact Info */}
                <Card className="md:col-span-1 shadow-none border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-display text-muted-foreground">Contact Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Mobile</div>
                      <div className="font-medium">{selectedCustomer.phone} {selectedCustomer.phone2 ? `/ ${selectedCustomer.phone2}` : ""}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Address</div>
                      <div className="font-medium">{selectedCustomer.address || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">GST No</div>
                      <div className="font-medium">{selectedCustomer.gstNumber || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">PAN No</div>
                      <div className="font-medium">{selectedCustomer.pan || "—"}</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Financial Summary */}
                <div className="md:col-span-2 grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card className="shadow-none border-border">
                    <CardContent className="pt-6">
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Receipt className="w-4 h-4"/> Total Sales</div>
                      <div className="text-xl font-display mt-1 text-primary">{inr(totalSales)}</div>
                      <div className="text-xs text-muted-foreground mt-1">{custInvoices.length} bills</div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-none border-border">
                    <CardContent className="pt-6">
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="w-4 h-4 text-green-500"/> Total Paid</div>
                      <div className="text-xl font-display mt-1 text-green-600">{inr(totalPaid)}</div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-none border-border">
                    <CardContent className="pt-6">
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="w-4 h-4 text-rose-500"/> Balance Due</div>
                      <div className="text-xl font-display mt-1 text-rose-600">{inr(totalDue)}</div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Invoices List */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-lg flex items-center gap-2"><Receipt className="w-5 h-5"/> Billing History</h3>
                  <Button size="sm" variant="outline" onClick={() => {
                    setManualDue({
                      ...defaultManualDue,
                      customerId: selectedCustomer?._id || selectedCustomer?.id || "NEW",
                      customerName: selectedCustomer?.name || "",
                      phone: selectedCustomer?.phone || "",
                      phone2: selectedCustomer?.phone2 || "",
                      address: selectedCustomer?.address || "",
                      gstNumber: selectedCustomer?.gstNumber || "",
                      pan: selectedCustomer?.pan || "",
                      notes: selectedCustomer?.notes || "",
                    });
                    setManualDueOpen(true);
                  }}>+ Add Manual Due</Button>
                </div>
                <Card className="shadow-none border-border">
                  <CardContent className="p-0">
                    {custInvoices.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">No bills for this customer.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-left text-muted-foreground border-b bg-muted/20">
                          <tr>
                            <th className="py-2 px-4">Invoice</th>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Items</th>
                            <th className="text-right">Total</th>
                            <th className="text-right">Paid</th>
                            <th className="text-right px-4">Due</th>
                            <th className="text-right px-4">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {custInvoices.map((inv) => (
                            <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/40">
                              <td className="py-2 px-4 font-medium">{inv.number}</td>
                              <td>{formatDate(inv.createdAt)}</td>
                              <td>{inv.type === "NON-GST" && inv.number?.startsWith("MAN-") ? "Manual Due" : inv.type}</td>
                              <td className="py-2">
                                <div className="text-xs text-muted-foreground truncate max-w-40" title={inv.items?.map(it => it.name).join(", ")}>
                                  {inv.items?.map(it => it.name).join(", ") || "—"}
                                </div>
                              </td>
                              <td className="text-right">{inr(inv.total)}</td>
                              <td className="text-right text-green-600">{inr(inv.amountPaid !== undefined ? inv.amountPaid : inv.total)}</td>
                              <td className="text-right px-4 text-rose-600 font-medium">{inr(inv.balanceDue || 0)}</td>
                              <td className="text-right px-4">
                                {(inv.balanceDue || 0) > 0 && (
                                  <Button size="sm" variant="outline" onClick={() => openPayModal('invoice', inv, inv.balanceDue || 0)}>Pay Due</Button>
                                )}
                                {(inv.balanceDue || 0) <= 0 && (
                                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase inline-block">Paid</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>
              {/* Payment History */}
              <div className="mt-4">
                <h3 className="font-display text-lg mb-3 flex items-center gap-2"><Wallet className="w-5 h-5"/> Payment History</h3>
                <Card className="shadow-none border-border">
                  <CardContent className="p-4">
                    {Object.keys(groupedPayments).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">No payments recorded.</p>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {Object.entries(groupedPayments).map(([invNo, pmts]) => (
                          <div key={invNo} className="border border-border rounded-lg overflow-hidden">
                            <div className="bg-muted/20 px-4 py-2 font-medium text-sm text-primary flex justify-between items-center border-b border-border/50">
                              <span>Bill / Due: {invNo}</span>
                              <span className="text-xs text-muted-foreground">Total Paid: <span className="text-green-600 font-bold">{inr(pmts.reduce((s, p) => s + p.amount, 0))}</span></span>
                            </div>
                            <table className="w-full text-sm">
                              <thead className="text-left text-muted-foreground border-b border-border/50">
                                <tr>
                                  <th className="py-2 px-4 w-1/4">Date</th>
                                  <th className="w-1/4">Mode</th>
                                  <th className="w-1/4">Note</th>
                                  <th className="text-right px-4 w-1/4">Amount Paid</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pmts.map((p, idx) => (
                                  <tr key={idx} className="border-b border-border/50 last:border-0 hover:bg-muted/40">
                                    <td className="py-2 px-4">{formatDate(p.date)}</td>
                                    <td>{p.mode}</td>
                                    <td className="text-muted-foreground">{p.note || "—"}</td>
                                    <td className="text-right px-4 text-green-600 font-medium">{inr(p.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Active Orders */}
              <div className="mt-4">
                <h3 className="font-display text-lg mb-3 flex items-center gap-2"><ShoppingBag className="w-5 h-5"/> Custom Orders</h3>
                <Card className="shadow-none border-border">
                  <CardContent className="p-0">
                    {custOrders.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">No orders.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-left text-muted-foreground border-b bg-muted/20">
                          <tr>
                            <th className="py-2 px-4">Order No</th>
                            <th>Date</th>
                            <th>Item Details</th>
                            <th className="text-right">Est. Total</th>
                            <th className="text-right">Paid</th>
                            <th className="text-right">Due</th>
                            <th className="text-center px-4">Status</th>
                            <th className="text-right px-4">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {custOrders.map((o) => {
                            const due = (o.estimatedPrice || 0) - (o.advancePaid || 0);
                            return (
                            <tr key={o.id} className="border-b last:border-0 hover:bg-muted/40">
                              <td className="py-2 px-4 font-medium">{o.orderNo}</td>
                              <td>{formatDate(o.date)}</td>
                              <td>
                                <div className="font-medium">{o.itemDescription}</div>
                                <div className="text-xs text-muted-foreground">{o.metal} {o.purity} • {o.estimatedWeight}g</div>
                              </td>
                              <td className="text-right">{inr(o.estimatedPrice)}</td>
                              <td className="text-right text-green-600">{inr(o.advancePaid)}</td>
                              <td className="text-right text-rose-600 font-medium">{due > 0 ? inr(due) : "—"}</td>
                              <td className="text-center px-4">
                                <span className="inline-block px-2 py-1 bg-muted rounded-full text-xs">{o.status}</span>
                              </td>
                              <td className="text-right px-4">
                                {due > 0 && o.status !== "Delivered" && o.status !== "Cancelled" && (
                                  <Button size="sm" variant="outline" onClick={() => openPayModal('order', o, due)}>Pay Due</Button>
                                )}
                              </td>
                            </tr>
                          )})}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Repairs */}
              <div className="mt-4">
                <h3 className="font-display text-lg mb-3 flex items-center gap-2"><Wrench className="w-5 h-5"/> Repairs</h3>
                <Card className="shadow-none border-border">
                  <CardContent className="p-0">
                    {custRepairs.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">No repairs.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-left text-muted-foreground border-b bg-muted/20">
                          <tr>
                            <th className="py-2 px-4">Ticket No</th>
                            <th>Date</th>
                            <th>Item Details</th>
                            <th>Problem</th>
                            <th className="text-right">Estimate</th>
                            <th className="text-right">Paid</th>
                            <th className="text-right">Due</th>
                            <th className="text-center px-4">Status</th>
                            <th className="text-right px-4">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {custRepairs.map((r) => {
                            const due = (r.estimate || 0) - (r.advance || 0);
                            return (
                            <tr key={r.id || r._id} className="border-b last:border-0 hover:bg-muted/40">
                              <td className="py-2 px-4 font-medium">{r.ticketNo}</td>
                              <td>{formatDate(r.date)}</td>
                              <td>
                                <div className="font-medium">{r.itemDescription}</div>
                                <div className="text-xs text-muted-foreground">{r.itemWeight}g</div>
                              </td>
                              <td className="text-rose-500 max-w-37.5 truncate" title={r.problem}>{r.problem}</td>
                              <td className="text-right">{inr(r.estimate)}</td>
                              <td className="text-right text-green-600">{inr(r.advance)}</td>
                              <td className="text-right text-rose-600 font-medium">{due > 0 ? inr(due) : "—"}</td>
                              <td className="text-center px-4">
                                <span className="inline-block px-2 py-1 bg-muted rounded-full text-xs">{r.status}</span>
                              </td>
                              <td className="text-right px-4">
                                {due > 0 && r.status !== "Delivered" && (
                                  <Button size="sm" variant="outline" onClick={() => openPayModal('repair', r, due)}>Pay Due</Button>
                                )}
                              </td>
                            </tr>
                          )})}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Girvi Loans */}
              <div className="mt-4">
                <h3 className="font-display text-lg mb-3 flex items-center gap-2"><Wallet className="w-5 h-5"/> Girvi Loans</h3>
                <Card className="shadow-none border-border">
                    <CardContent className="p-0">
                      {custGirvis.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">No girvi loans.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="text-left text-muted-foreground border-b bg-muted/20">
                            <tr>
                              <th className="py-2 px-4">Loan No</th>
                              <th>Date</th>
                              <th>Item Description</th>
                              <th className="text-right">Amount</th>
                              <th className="text-center px-4">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {custGirvis.map((g) => (
                              <tr key={g.id} className="border-b last:border-0 hover:bg-muted/40">
                                <td className="py-2 px-4 font-medium">{g.loanNo}</td>
                                <td>{formatDate(g.date)}</td>
                                <td>
                                  <div className="font-medium">{g.itemType} {g.purity}</div>
                                  <div className="text-xs text-muted-foreground">{g.itemDescription}</div>
                                </td>
                                <td className="text-right">{inr(g.loanAmount)}</td>
                                <td className="text-center px-4">
                                  <span className="inline-block px-2 py-1 bg-muted rounded-full text-xs">{g.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </CardContent>
                  </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={!!payModal} onOpenChange={(v) => !v && setPayModal(null)}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          {payModal && (
            <>
              <DialogHeader>
                <DialogTitle>Record Payment - {payModal?.type.toUpperCase()}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="text-sm text-muted-foreground">
                  Paying for {payModal?.type === 'invoice' ? 'Invoice' : payModal?.type === 'order' ? 'Order' : 'Repair'}
                  <strong className="text-foreground mx-1">{payModal?.type === 'invoice' ? payModal?.item?.number : payModal?.type === 'order' ? payModal?.item?.orderNo : payModal?.item?.ticketNo}</strong>.
                  Current Due: <strong className="text-rose-600">{inr(payModal?.due || 0)}</strong>
                </div>
                <F label="Payment Amount ₹ *">
                  <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value === "" ? "" : Number(e.target.value))} />
                </F>
                <F label="Payment Mode">
                  <Select value={payMode} onValueChange={setPayMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="Bank">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </F>
                <F label="Note (Optional)">
                  <Input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Transaction ID, remarks..." />
                </F>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPayModal(null)}>Cancel</Button>
                <Button onClick={submitPayment} disabled={updateInvoiceMutation.isPending || updateOrderMutation.isPending || updateRepairMutation.isPending || !payAmount}>Save Payment</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Manual Due Dialog */}
      <Dialog open={manualDueOpen} onOpenChange={setManualDueOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Add Manual Due</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            {/* Customer Section */}
            <div className="p-4 border rounded-lg bg-muted/10 space-y-4">
              <h3 className="font-semibold text-primary">1. Customer Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <F label="Select Customer">
                    <Select value={manualDue.customerId} onValueChange={(val) => {
                      if (val === "NEW") {
                        setManualDue({ ...manualDue, customerId: "NEW", customerName: "", phone: "", phone2: "", address: "", gstNumber: "", pan: "", notes: "" });
                      } else {
                        const c = customers.find((x: Customer) => x._id === val || x.id === val);
                        if (c) {
                          setManualDue({ ...manualDue, customerId: c._id || c.id || "", customerName: c.name, phone: c.phone, phone2: c.phone2||"", address: c.address||"", gstNumber: c.gstNumber||"", pan: c.pan||"", notes: c.notes||"" });
                        }
                      }
                    }}>
                      <SelectTrigger className="bg-background"><SelectValue placeholder="Select or create customer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NEW" className="font-semibold text-primary">+ Create New Customer</SelectItem>
                        {customers.map((c: Customer) => (
                          <SelectItem key={c._id || c.id} value={c._id || c.id || ""}>{c.name} - {c.phone}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </F>
                </div>
                <F label="Customer Name *"><Input className="bg-background" value={manualDue.customerName} onChange={e => setManualDue({...manualDue, customerName: e.target.value})} disabled={manualDue.customerId !== "NEW"} /></F>
                <F label="Mobile No *"><Input className="bg-background" value={manualDue.phone} onChange={e => setManualDue({...manualDue, phone: e.target.value})} disabled={manualDue.customerId !== "NEW"} /></F>
                <F label="Mobile No 2 (optional)"><Input className="bg-background" value={manualDue.phone2} onChange={e => setManualDue({...manualDue, phone2: e.target.value})} disabled={manualDue.customerId !== "NEW"} /></F>
                <F label="GST No (optional)"><Input className="bg-background" value={manualDue.gstNumber} onChange={e => setManualDue({...manualDue, gstNumber: e.target.value})} disabled={manualDue.customerId !== "NEW"} /></F>
                <F label="PAN No (optional)"><Input className="bg-background" value={manualDue.pan} onChange={e => setManualDue({...manualDue, pan: e.target.value})} disabled={manualDue.customerId !== "NEW"} /></F>
                <div className="sm:col-span-2"><F label="Address (optional)"><Input className="bg-background" value={manualDue.address} onChange={e => setManualDue({...manualDue, address: e.target.value})} disabled={manualDue.customerId !== "NEW"} /></F></div>
                <div className="sm:col-span-2"><F label="Notes (optional)"><Input className="bg-background" value={manualDue.notes} onChange={e => setManualDue({...manualDue, notes: e.target.value})} disabled={manualDue.customerId !== "NEW"} /></F></div>
              </div>
            </div>

            {/* Product Section */}
            <div className="p-4 border rounded-lg bg-muted/10 space-y-4">
              <h3 className="font-semibold text-primary">2. Product Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <F label="Item Name / Description *">
                    <Input className="bg-background" value={manualDue.itemName} onChange={e => setManualDue({...manualDue, itemName: e.target.value})} placeholder="E.g., Gold Chain, Old repair balance..." />
                  </F>
                </div>
                <F label="Purity"><Input className="bg-background" value={manualDue.purity} onChange={e => setManualDue({...manualDue, purity: e.target.value})} placeholder="22K" /></F>
                <F label="Net Weight (g)">
                  <Input className="bg-background" type="number" value={manualDue.netWeight} onChange={e => {
                    const nw = e.target.value === "" ? "" : Number(e.target.value);
                    const rg = Number(manualDue.ratePerGram) || 0;
                    const mc = Number(manualDue.makingCharge) || 0;
                    const tv = nw !== "" ? (nw * rg) + mc : (manualDue.totalValue || "");
                    setManualDue({...manualDue, netWeight: nw, totalValue: tv});
                  }} />
                </F>
                <F label="Rate / g (₹)">
                  <Input className="bg-background" type="number" value={manualDue.ratePerGram} onChange={e => {
                    const rg = e.target.value === "" ? "" : Number(e.target.value);
                    const nw = Number(manualDue.netWeight) || 0;
                    const mc = Number(manualDue.makingCharge) || 0;
                    const tv = rg !== "" ? (nw * rg) + mc : (manualDue.totalValue || "");
                    setManualDue({...manualDue, ratePerGram: rg, totalValue: tv});
                  }} />
                </F>
                <F label="Making Charge (₹)">
                  <Input className="bg-background" type="number" value={manualDue.makingCharge} onChange={e => {
                    const mc = e.target.value === "" ? "" : Number(e.target.value);
                    const nw = Number(manualDue.netWeight) || 0;
                    const rg = Number(manualDue.ratePerGram) || 0;
                    const tv = mc !== "" ? (nw * rg) + mc : (manualDue.totalValue || "");
                    setManualDue({...manualDue, makingCharge: mc, totalValue: tv});
                  }} />
                </F>
              </div>
            </div>

            {/* Financials Section */}
            <div className="p-4 border rounded-lg bg-muted/10 space-y-4">
              <h3 className="font-semibold text-primary">3. Financials</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <F label="Total Item Value (₹) *">
                  <Input className="bg-background font-medium text-lg" type="number" value={manualDue.totalValue} onChange={e => setManualDue({...manualDue, totalValue: e.target.value === "" ? "" : Number(e.target.value)})} />
                </F>
                <F label="Due Amount (₹) *">
                  <Input className="bg-background font-medium text-lg text-rose-600" type="number" value={manualDue.dueAmount} onChange={e => setManualDue({...manualDue, dueAmount: e.target.value === "" ? "" : Number(e.target.value)})} />
                </F>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDueOpen(false)}>Cancel</Button>
            <Button onClick={saveManualDue} disabled={createInvoiceMutation.isPending || !manualDue.itemName || manualDue.totalValue === "" || manualDue.dueAmount === "" || (!manualDue.customerName && manualDue.customerId === "NEW")}>
              Save Manual Due
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}


function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
