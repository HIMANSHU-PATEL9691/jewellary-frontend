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
import { Plus, Trash2, Pencil, Search, Loader2, Eye, Receipt, Wallet, ShoppingBag, UserCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { customerAPI, invoicesAPI, ordersAPI, girviAPI } from "@/lib/api";
import { inr, type Invoice, type Order, type Girvi } from "@/lib/storage";
import { toast } from "sonner";

interface Customer {
  _id?: string;
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
    if (!draft.name || !draft.phone || !draft.address || !draft.notes) {
      toast.error("Name, phone, address, and notes are required");
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

  const totalSales = custInvoices.reduce((s, i) => s + i.total, 0);
  const totalPaid = custInvoices.reduce((s, i) => s + (i.amountPaid !== undefined ? i.amountPaid : i.total), 0);
  const totalDue = custInvoices.reduce((s, i) => s + (i.balanceDue || 0), 0);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState<number | "">("");
  const [payMode, setPayMode] = useState("Cash");
  const [payNote, setPayNote] = useState("");

  const openPayModal = (inv: Invoice) => {
    setPayInvoice(inv);
    setPayAmount(inv.balanceDue || 0);
    setPayMode("Cash");
    setPayNote("");
    setPayModalOpen(true);
  };

  const submitPayment = async () => {
    if (!payInvoice || !payAmount || payAmount <= 0) return;
    const amt = Number(payAmount);
    const newPaid = (payInvoice.amountPaid || 0) + amt;
    const newDue = Math.max(0, (payInvoice.balanceDue || 0) - amt);
    const newPayment = {
      date: new Date().toISOString(),
      amount: amt,
      mode: payMode,
      note: payNote
    };
    const updatedPayments = [...(payInvoice.payments || []), newPayment];

    try {
      await updateInvoiceMutation.mutateAsync({
        id: payInvoice._id || payInvoice.id,
        body: { ...payInvoice, amountPaid: newPaid, balanceDue: newDue, payments: updatedPayments } as Partial<Invoice>
      });
      toast.success("Payment recorded successfully!");
      setPayModalOpen(false);
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

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Customers</h1>
          <p className="text-muted-foreground mt-1">{customers.length} on file.</p>
        </div>
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
              <F label="Address *">
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
              <F label="Notes *">
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
              <Button onClick={save} disabled={isLoading_UI || !draft.name || !draft.phone || !draft.address || !draft.notes}>
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
                <h3 className="font-display text-lg mb-3 flex items-center gap-2"><Receipt className="w-5 h-5"/> Billing History</h3>
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
                              <td>{inv.type}</td>
                              <td className="text-right">{inr(inv.total)}</td>
                              <td className="text-right text-green-600">{inr(inv.amountPaid !== undefined ? inv.amountPaid : inv.total)}</td>
                              <td className="text-right px-4 text-rose-600 font-medium">{inr(inv.balanceDue || 0)}</td>
                              <td className="text-right px-4">
                                {(inv.balanceDue || 0) > 0 && (
                                  <Button size="sm" variant="outline" onClick={() => openPayModal(inv)}>Pay Due</Button>
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
                  <CardContent className="p-0">
                    {allPayments.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">No payments recorded.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-left text-muted-foreground border-b bg-muted/20">
                          <tr>
                            <th className="py-2 px-4">Date</th>
                            <th>Invoice</th>
                            <th>Mode</th>
                            <th>Note</th>
                            <th className="text-right px-4">Amount Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allPayments.map((p, idx) => (
                            <tr key={idx} className="border-b last:border-0 hover:bg-muted/40">
                              <td className="py-2 px-4">{formatDate(p.date)}</td>
                              <td className="font-medium">{p.invoiceNo}</td>
                              <td>{p.mode}</td>
                              <td className="text-muted-foreground">{p.note || "—"}</td>
                              <td className="text-right px-4 text-green-600 font-medium">{inr(p.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Active Orders / Girvi */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                <div>
                  <h3 className="font-display text-lg mb-3 flex items-center gap-2"><ShoppingBag className="w-5 h-5"/> Orders</h3>
                  <Card className="shadow-none border-border">
                    <CardContent className="p-0">
                      {custOrders.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">No orders.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="text-left text-muted-foreground border-b bg-muted/20">
                            <tr>
                              <th className="py-2 px-4">Order No</th>
                              <th>Item</th>
                              <th className="text-right px-4">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {custOrders.map((o) => (
                              <tr key={o.id} className="border-b last:border-0 hover:bg-muted/40">
                                <td className="py-2 px-4 font-medium">{o.orderNo}</td>
                                <td>{o.itemDescription}</td>
                                <td className="text-right px-4">
                                  <span className="inline-block px-2 py-1 bg-muted rounded-full text-xs">{o.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </CardContent>
                  </Card>
                </div>
                <div>
                  <h3 className="font-display text-lg mb-3 flex items-center gap-2"><Wallet className="w-5 h-5"/> Girvi Loans</h3>
                  <Card className="shadow-none border-border">
                    <CardContent className="p-0">
                      {custGirvis.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">No girvi.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="text-left text-muted-foreground border-b bg-muted/20">
                            <tr>
                              <th className="py-2 px-4">Loan No</th>
                              <th className="text-right">Amount</th>
                              <th className="text-right px-4">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {custGirvis.map((g) => (
                              <tr key={g.id} className="border-b last:border-0 hover:bg-muted/40">
                                <td className="py-2 px-4 font-medium">{g.loanNo}</td>
                                <td className="text-right">{inr(g.loanAmount)}</td>
                                <td className="text-right px-4">
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
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">Paying for Invoice <strong className="text-foreground">{payInvoice?.number}</strong>. Current Due: <strong className="text-rose-600">{inr(payInvoice?.balanceDue || 0)}</strong></div>
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
            <Button variant="outline" onClick={() => setPayModalOpen(false)}>Cancel</Button>
            <Button onClick={submitPayment} disabled={updateInvoiceMutation.isPending || !payAmount}>Save Payment</Button>
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
