import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Printer, Receipt } from "lucide-react";
import {
  inr,
  calcItem,
  type Invoice,
  type InvoiceItem,
} from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { invoicesAPI, inventoryAPI, customerAPI } from "@/lib/api";
import { toast } from "sonner";

export default function BillingPage() {
  const { data: invoices = [] } = useApi<any[]>(["invoices"], () => invoicesAPI.getAll());
  const { data: products = [] } = useApi<any[]>(["inventory"], () => inventoryAPI.getAll());
  const { data: customers = [] } = useApi<any[]>(["customers"], () => customerAPI.getAll());
  
  const createMutation = useApiMutation((data: any) => invoicesAPI.create(data), ["invoices"]);
  const deleteMutation = useApiMutation((id: string) => invoicesAPI.delete(id), ["invoices"]);

  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [open, setOpen] = useState(false);

  const [type, setType] = useState<"GST" | "NON-GST">("GST");
  const [customerId, setCustomerId] = useState<string>("");
  const [searchCust, setSearchCust] = useState("");
  const [searchProd, setSearchProd] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [oldGoldAmount, setOldGoldAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<Invoice["paymentMode"]>("Cash");
  const [amountPaid, setAmountPaid] = useState<number | "">("");

  const isGst = type === "GST";

  const addProduct = (pid: string) => {
    const p = products.find((x) => (x.id || x._id) === pid);
    if (!p) return;
    setItems((prev) => [
      ...prev,
      {
        productId: p.id || p._id,
        name: p.name,
        purity: p.purity,
        netWeight: p.netWeight,
        ratePerGram: p.ratePerGram,
        makingCharge: p.makingCharge,
        makingChargePct: p.makingChargePct || 0,
        stoneCharge: 0,
        gstPct: p.gstPct,
        qty: 1,
      },
    ]);
  };

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const totals = useMemo(() => {
    let subtotal = 0;
    let gst = 0;

    items.forEach((it) => {
      const c = calcItem(it, isGst);
      subtotal += c.line;
      gst += c.gst;
    });

    const afterAdj = subtotal - discount - oldGoldAmount;
    const preRound = Math.round((afterAdj + gst) * 100) / 100;
    const gTotal = Math.round(preRound);
    const roundOff = Math.round((gTotal - preRound) * 100) / 100;
    const cgst = gst / 2;
    const sgst = gst / 2;

    return { subtotal, gst, cgst, sgst, preRound, roundOff, gTotal };
  }, [items, discount, oldGoldAmount, isGst]);

  const reset = () => {
    setItems([]);
    setDiscount(0);
    setOldGoldAmount(0);
    setCustomerId("");
    setAmountPaid("");
  };

  const save = async () => {
    if (items.length === 0 || !customerId) {
      toast.error("Please select a customer and add items.");
      return;
    }

    const cust = customers.find((c) => (c._id || c.id) === customerId);
    if (!cust) {
      toast.error("Selected customer not found.");
      return;
    }

    const actualPaid = amountPaid === "" ? totals.gTotal : Number(amountPaid);
    const safeActualPaid = Number.isFinite(actualPaid) ? actualPaid : totals.gTotal;
    const balanceDue = totals.gTotal - safeActualPaid;

    const initialPayment = safeActualPaid > 0 ? [
      {
        date: new Date().toISOString(),
        amount: safeActualPaid,
        mode: paymentMode,
        note: "Initial Payment",
      },
    ] : [];

    const inv: any = {
      number: "INV-" + (invoices.length + 1).toString().padStart(4, "0"),
      type,
      customerId: cust?._id || cust?.id,
      customerName: cust?.name,
      customerMobile: cust?.mobile || cust?.phone || "",
      items,
      discount: discount || 0,
      oldGoldAmount: oldGoldAmount || 0,
      paymentMode,
      subtotal: totals.subtotal,
      gstAmount: totals.gst,
      total: totals.gTotal,
      amountPaid: safeActualPaid,
      balanceDue,
      payments: initialPayment,
    };

    try {
      const saved = await createMutation.mutateAsync(inv);
      setViewing(saved);
      reset();
      setOpen(false);
      toast.success("Invoice generated successfully");
    } catch (e) {
      toast.error("Failed to generate invoice");
    }
  };

  const today = new Date().toDateString();
  const todayInvoices = invoices.filter(i => new Date(i.createdAt).toDateString() === today);
  const todayRevenue = todayInvoices.reduce((s, i) => s + i.total, 0);

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Billing & Invoices</h1>
          <p className="text-muted-foreground mt-1">Manage sales invoices and point-of-sale.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="w-4 h-4 mr-2" /> New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] lg:max-w-5xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-display">Create Invoice</DialogTitle>
            </DialogHeader>
            <form className="space-y-6 mt-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
              
              {/* 1. Invoice Details */}
              <div className="p-5 border rounded-lg bg-muted/10 space-y-4">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">1</span>
                  Invoice Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Invoice Type</Label>
                    <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GST">GST Invoice</SelectItem>
                        <SelectItem value="NON-GST">Non-GST Invoice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Search Customer</Label>
                    <Input
                      className="bg-background"
                      placeholder="Search name or mobile..."
                      value={searchCust}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSearchCust(v);
                        const match = customers.find(
                          (c) =>
                            c.mobile === v ||
                            c.phone === v ||
                            c.name.toLowerCase() === v.toLowerCase()
                        );
                        if (match) setCustomerId(match._id || match.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (searchCust.trim() !== "") {
                            const v = searchCust.toLowerCase().trim();
                            const match = customers.find(
                              (c) => c.name.toLowerCase().includes(v) || (c.mobile || c.phone || "").includes(v)
                            );
                            if (match) setCustomerId(match._id || match.id);
                          }
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Customer</Label>
                      <Select value={customerId} onValueChange={setCustomerId}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers
                            .filter(
                              (c) =>
                                c.name.toLowerCase().includes(searchCust.toLowerCase()) ||
                                (c.mobile || c.phone || "").includes(searchCust)
                            )
                            .map((c) => (
                              <SelectItem key={c._id || c.id} value={c._id || c.id}>
                                {c.name} · {c.mobile || c.phone}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {customerId && (
                      <div className="p-3 rounded-md bg-background border border-border text-sm">
                        {(() => {
                          const c = customers.find((x) => (x._id || x.id) === customerId);
                          if (!c) return null;
                          return (
                            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                              <div>
                                <strong className="text-foreground">Name:</strong> {c.name}
                              </div>
                              <div>
                                <strong className="text-foreground">Mobile:</strong>{" "}
                                {c.mobile || c.phone}
                              </div>
                              <div className="col-span-2">
                                <strong className="text-foreground">Address:</strong>{" "}
                                {c.address || "—"}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Items */}
              <div className="p-5 border rounded-lg bg-muted/10 space-y-4">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">2</span>
                  Items
                </h3>
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <Input
                      placeholder="Type name/barcode & press Enter..."
                      value={searchProd}
                      onChange={(e) => setSearchProd(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (searchProd.trim() !== "") {
                            const query = searchProd.toLowerCase().trim();
                          const matches = products.filter(
                            (p) =>
                              p.name.toLowerCase().includes(query) ||
                              (p.barcode || "").toLowerCase() === query ||
                              (p.huid || "").toLowerCase() === query
                          );
                          if (matches.length > 0) {
                            const exact = matches.find(
                              (p) =>
                                p.name.toLowerCase() === query ||
                                (p.barcode || "").toLowerCase() === query ||
                                (p.huid || "").toLowerCase() === query
                            );
                            addProduct((exact || matches[0])._id || (exact || matches[0]).id);
                            setSearchProd("");
                          } else {
                            toast.error("No product found matching this name or barcode.");
                          }
                          }
                        }
                      }}
                      className="bg-background w-full sm:w-64"
                    />

                    <div className="w-full sm:w-64">
                      <Select
                        value=""
                        onValueChange={(val) => {
                          addProduct(val);
                          setSearchProd("");
                        }}
                      >
                        <SelectTrigger className="bg-background w-full sm:w-64">
                          <SelectValue
                            placeholder={
                              products.length ? "Add product…" : "No products in inventory"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {products
                            .filter(
                              (p) =>
                                p.name.toLowerCase().includes(searchProd.toLowerCase()) ||
                                (p.barcode || "")
                                  .toLowerCase()
                                  .includes(searchProd.toLowerCase()) ||
                                (p.huid || "")
                                  .toLowerCase()
                                  .includes(searchProd.toLowerCase())
                            )
                            .map((p) => (
                              <SelectItem key={p._id || p.id} value={p._id || p.id}>
                                {p.name} · {p.barcode || p.huid || p.purity} · {p.stock} in stock
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                </div>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">
                      Add products from the dropdown to start billing.
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="text-left text-muted-foreground border-b bg-muted/20">
                        <tr>
                          <th className="p-3 font-medium">Product</th>
                          <th className="py-3 font-medium w-24">Qty</th>
                          <th className="py-3 font-medium w-28">Net Wt (g)</th>
                          <th className="py-3 font-medium w-28">Rate (₹/g)</th>
                          <th className="py-3 font-medium w-28">Amount</th>
                          <th className="py-3 font-medium w-20">Making (%)</th>
                          <th className="py-3 font-medium w-28">Making (₹)</th>
                          <th className="py-3 font-medium text-right pr-3 w-32">Total (₹)</th>
                          <th className="w-12" />
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, i) => {
                          const c = calcItem(it, isGst);
                          const amount = it.netWeight * it.ratePerGram;
                          return (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                              <td className="p-3">
                                <div className="font-medium text-primary">{it.name}</div>
                                <div className="text-xs text-muted-foreground">{it.purity}</div>
                              </td>
                              <td className="py-2">
                                <NumI v={it.qty} on={(v) => updateItem(i, { qty: v })} className="w-16 h-8 bg-background" />
                              </td>
                              <td className="py-2">
                                <NumI
                                  v={it.netWeight}
                                on={(v) => {
                                  const patch: any = { netWeight: v };
                                  if (it.makingChargePct) patch.makingCharge = (v * it.ratePerGram * it.makingChargePct) / 100;
                                  updateItem(i, patch);
                                }}
                                  className="w-20 h-8 bg-background"
                                />
                              </td>
                              <td className="py-2">
                                <NumI
                                  v={it.ratePerGram}
                                on={(v) => {
                                  const patch: any = { ratePerGram: v };
                                  if (it.makingChargePct) patch.makingCharge = (it.netWeight * v * it.makingChargePct) / 100;
                                  updateItem(i, patch);
                                }}
                                  className="w-20 h-8 bg-background"
                                />
                              </td>
                              <td className="py-2 font-medium">{inr(amount)}</td>
                            <td className="py-2">
                              <NumI
                                v={it.makingChargePct || 0}
                                on={(v) => {
                                  const amt = it.netWeight * it.ratePerGram;
                                  updateItem(i, { makingChargePct: v, makingCharge: (amt * v) / 100 });
                                }}
                                className="w-16 h-8 bg-background"
                              />
                            </td>
                              <td className="py-2">
                                <NumI
                                  v={it.makingCharge}
                                on={(v) => updateItem(i, { makingCharge: v, makingChargePct: 0 })}
                                  className="w-20 h-8 bg-background"
                                />
                              </td>
                              <td className="py-2 text-right pr-3 font-medium">{inr(c.line)}</td>
                              <td className="py-2 text-right">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeItem(i)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
              </div>

              {/* 3. Payment Summary */}
              <div className="p-5 border rounded-lg bg-muted/10 space-y-4">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">3</span>
                  Payment Summary
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="text-sm text-muted-foreground bg-background p-4 rounded-lg border border-border">
                    <p className="font-medium text-foreground mb-2">Billing Instructions:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Verify the customer and item details before generating.</li>
                      <li>Any discount or old gold amount entered will be deducted from the subtotal.</li>
                      <li>GST is calculated automatically if 'GST Invoice' is selected.</li>
                    </ul>
                  </div>
                  <div className="space-y-4 text-sm bg-background p-5 rounded-lg border border-border shadow-sm">
                    <Row label="Subtotal" v={inr(totals.subtotal)} />
                    
                    <div className="flex items-center justify-between gap-4">
                      <Label className="text-muted-foreground font-normal">Discount (₹)</Label>
                      <Input type="number" className="w-32 h-8 text-right bg-background" value={discount || ""} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} placeholder="0" />
                    </div>
                    
                    <div className="flex items-center justify-between gap-4">
                      <Label className="text-muted-foreground font-normal">Old Gold (₹)</Label>
                      <Input type="number" className="w-32 h-8 text-right bg-background" value={oldGoldAmount || ""} onChange={(e) => setOldGoldAmount(parseFloat(e.target.value) || 0)} placeholder="0" />
                    </div>

                    {isGst && (
                      <>
                        <Row label="CGST" v={inr(totals.cgst)} />
                        <Row label="SGST" v={inr(totals.sgst)} />
                      </>
                    )}
                    
                    <Row label="Round Off" v={inr(totals.roundOff)} />
                    
                    <div className="border-t pt-4 mt-2 flex justify-between items-center font-display text-xl text-primary">
                      <span>Grand Total</span>
                      <span>{inr(totals.gTotal)}</span>
                    </div>

                    <div className="bg-muted/40 p-4 rounded-lg border border-border space-y-4 mt-4">
                      <div className="flex items-center justify-between gap-4">
                        <Label className="text-muted-foreground font-normal">Amount Paid</Label>
                        <Input type="number" className="w-32 h-8 text-right bg-background" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)} placeholder={`${totals.gTotal}`} />
                      </div>
                      
                      <div className="flex items-center justify-between gap-4">
                        <Label className="text-muted-foreground font-normal">Payment Mode</Label>
                        <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as Invoice["paymentMode"])}>
                          <SelectTrigger className="w-32 h-8 bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(["Cash", "UPI", "Card", "EMI"] as const).map((m) => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Row 
                        label="Balance Due" 
                        v={inr(totals.gTotal - (amountPaid === "" ? totals.gTotal : (amountPaid as number)))} 
                        valueClassName={(totals.gTotal - (amountPaid === "" ? totals.gTotal : (amountPaid as number))) > 0 ? "text-rose-600" : "text-green-600"}
                      />
                    </div>

                    <Button type="submit" className="w-full mt-2" size="lg" disabled={items.length === 0 || !customerId}>
                      <Plus className="w-4 h-4 mr-2" /> Generate Invoice
                    </Button>
              </div>
            </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPI label="Total Invoices" value={invoices.length} />
        <KPI label="Today's Invoices" value={todayInvoices.length} />
        <KPI label="Today's Revenue" value={inr(todayRevenue)} />
      </div>

          <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Receipt className="w-5 h-5" /> Invoice History
          </CardTitle>
        </CardHeader>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">No invoices yet.</p>
              ) : (
                <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b bg-muted/20">
                    <tr>
                  <th className="p-3 font-medium">Invoice</th>
                  <th className="font-medium">Date</th>
                  <th className="font-medium">Customer</th>
                  <th className="font-medium">Type</th>
                  <th className="font-medium">Mode</th>
                  <th className="text-right font-medium">Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((i) => (
                      <tr key={i._id || i.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="p-3 font-medium">{i.number}</td>
                        <td>{formatDate(i.createdAt)}</td>
                        <td>{i.customerName}</td>
                        <td>{i.type}</td>
                        <td>{i.paymentMode}</td>
                    <td className="text-right font-medium text-green-600">{inr(i.total)}</td>
                        <td>
                      <div className="flex justify-end gap-2 pr-3">
                        <Button size="sm" variant="outline" onClick={() => setViewing(i)}>View</Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutateAsync(i._id || i.id)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

      {viewing && <InvoiceModal inv={viewing} onClose={() => setViewing(null)} />}
    </Layout>
  );
}

function Row({ label, v, className, valueClassName }: { label: string; v: string; className?: string; valueClassName?: string }) {
  return (
    <div className={`flex justify-between items-center ${className || ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${valueClassName || ""}`}>{v}</span>
    </div>
  );
}

function NumI({ v, on, className = "w-24 h-8" }: { v: number; on: (n: number) => void; className?: string }) {
  const [val, setVal] = useState(v.toString());

  // Update local state if the prop changes externally (e.g., reset)
  useEffect(() => {
    setVal((prev) => {
      const parsedPrev = parseFloat(prev);
      if (parsedPrev === v || (prev === "" && v === 0)) {
        return prev;
      }
      return v.toString();
    });
  }, [v]);

  return (
    <Input
      type="number"
      className={className}
      value={val}
      onBlur={() => {
        if (val === "" || isNaN(parseFloat(val))) {
          setVal("0");
          on(0);
        }
      }}
      onChange={(e) => {
        setVal(e.target.value);
        const parsed = parseFloat(e.target.value);
        if (!isNaN(parsed)) {
          on(parsed);
        } else if (e.target.value === "") {
          on(0);
        }
      }}
    />
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

function InvoiceModal({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4 print:bg-white print:p-0">
      <div className="bg-card w-full max-w-2xl rounded-lg shadow-xl p-8 print:shadow-none print:max-w-none">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-3xl font-display">Cloudiefy-Jewellery Software</h2>
            <p className="text-xs text-muted-foreground">Tax Invoice</p>
          </div>
          <div className="text-right text-sm">
            <div className="font-mono font-semibold">{inv.number}</div>
            <div className="text-muted-foreground">
              {formatDate(inv.createdAt)}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide">{inv.type}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Bill To</div>
            <div className="font-medium">{inv.customerName}</div>
            <div className="text-muted-foreground">{inv.customerMobile}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Payment</div>
            <div className="font-medium">{inv.paymentMode}</div>
          </div>
        </div>

        <table className="w-full text-sm mb-4">
          <thead className="text-left text-muted-foreground border-b">
            <tr>
              <th className="py-2">Product</th>
              <th>Quantity</th>
              <th>Weight</th>
              <th>Rate</th>
              <th>Amount</th>
              <th>Making Charges</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => {
              const c = calcItem(it, inv.type === "GST");
              const amount = it.netWeight * it.ratePerGram;
              return (
                <tr key={i} className="border-b">
                  <td className="py-2">
                    {it.name}
                    <span className="text-xs text-muted-foreground"> · {it.purity}</span>
                  </td>
                  <td>{it.qty}</td>
                  <td>{it.netWeight}g</td>
                  <td>{inr(it.ratePerGram)}</td>
                  <td>{inr(amount)}</td>
                  <td>{inr(it.makingCharge)}</td>
                  <td className="text-right">{inr(c.line)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="ml-auto w-64 space-y-1 text-sm">
          <Row label="Subtotal" v={inr(inv.subtotal)} />
          {inv.discount > 0 && <Row label="Discount" v={"- " + inr(inv.discount)} />}
          {inv.oldGoldAmount > 0 && <Row label="Old Gold" v={"- " + inr(inv.oldGoldAmount)} />}
          {inv.type === "GST" && (
            <>
              <Row label="CGST" v={inr(inv.gstAmount / 2)} />
              <Row label="SGST" v={inr(inv.gstAmount / 2)} />
            </>
          )}
          {(() => {
            const preRound = Math.round((inv.subtotal - inv.discount - inv.oldGoldAmount + (inv.type === "GST" ? inv.gstAmount : 0)) * 100) / 100;
            const roundOff = Math.round((inv.total - preRound) * 100) / 100;
            return roundOff !== 0 ? <Row label="Round Off" v={inr(roundOff)} /> : null;
          })()}
          <div className="border-t pt-2 flex justify-between font-display text-lg">
            <span>G.Total</span>
            <span>{inr(inv.total)}</span>
          </div>
          {inv.amountPaid !== undefined && inv.amountPaid < inv.total && (
            <>
              <Row label="Amount Paid" v={inr(inv.amountPaid)} />
              <Row label="Balance Due" v={inr(inv.balanceDue || 0)} />
            </>
          )}
        </div>

        <div className="mt-8 text-xs text-muted-foreground border-t pt-3">
          Thank you for shopping with Cloudiefy-Jewellery Software. Goods once sold cannot be returned.
        </div>

        <div className="flex justify-end gap-2 mt-6 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        </div>
      </div>
    </div>
  );
}
