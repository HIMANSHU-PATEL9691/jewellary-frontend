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
import { Plus, Trash2, Printer, Receipt, Pencil } from "lucide-react";
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
import { PaymentQr } from "@/components/PaymentQr";
import { InvoiceTerms, ShopHeader } from "@/components/InvoiceBranding";

export default function BillingPage() {
  const { data: invoices = [] } = useApi<any[]>(["invoices"], () => invoicesAPI.getAll());
  const { data: products = [] } = useApi<any[]>(["inventory"], () => inventoryAPI.getAll());
  const { data: customers = [] } = useApi<any[]>(["customers"], () => customerAPI.getAll());
  
  const createMutation = useApiMutation((data: any) => invoicesAPI.create(data), ["invoices"]);
  const deleteMutation = useApiMutation((id: string) => invoicesAPI.delete(id), ["invoices"]);
  const updateProductMutation = useApiMutation((data: { id: string; body: any }) => inventoryAPI.update(data.id, data.body), ["inventory"]);
  const updateMutation = useApiMutation((data: { id: string; body: any }) => invoicesAPI.update(data.id, data.body), ["invoices"]);

  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [type, setType] = useState<"GST" | "NON-GST">("GST");
  const [customerId, setCustomerId] = useState<string>("");
  const [searchCust, setSearchCust] = useState("");
  const [searchProd, setSearchProd] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState<number | "">("");
  const [oldGoldAmount, setOldGoldAmount] = useState<number | "">("");
  const [cashAmount, setCashAmount] = useState<number | "">("");
  const [onlineAmount, setOnlineAmount] = useState<number | "">("");
  const [onlineMode, setOnlineMode] = useState<string>("UPI");
  const [customerSignature, setCustomerSignature] = useState<string>("");
  const [authorizedSignatory, setAuthorizedSignatory] = useState<string>("");

  const isGst = type === "GST";

  const addProduct = (pid: string) => {
    const p = products.find((x) => (x.id || x._id) === pid);
    if (!p) return;

    if (p.stock <= 0) {
      toast.error(`Cannot add "${p.name}". It is currently out of stock.`);
      return;
    }

    let makingCharge = p.makingCharge || 0;
    let makingChargePct = p.makingChargePct || 0;

    if (makingChargePct > 0) {
      makingCharge = (p.netWeight * p.ratePerGram * makingChargePct) / 100;
    } else if (makingCharge > 0 && p.netWeight > 0 && p.ratePerGram > 0) {
      makingChargePct = Number(((makingCharge / (p.netWeight * p.ratePerGram)) * 100).toFixed(2));
    }

    setItems((prev) => [
      ...prev,
      {
        productId: p.id || p._id,
        name: p.name,
        purity: p.purity,
        netWeight: p.netWeight,
        ratePerGram: p.ratePerGram,
        makingCharge: makingCharge,
        makingChargePct: makingChargePct,
        stoneCharge: 0,
        gstPct: p.gstPct,
        qty: 1,
      },
    ]);
  };

  const addCustomItem = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: "manual-" + Date.now(),
        name: "",
        purity: "22K",
        netWeight: 0,
        ratePerGram: 0,
        makingCharge: 0,
        makingChargePct: 0,
        stoneCharge: 0,
        gstPct: type === "GST" ? 3 : 0,
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

    const afterAdj = subtotal - (Number(discount) || 0) - (Number(oldGoldAmount) || 0);
    const preRound = Math.round((afterAdj + gst) * 100) / 100;
    const gTotal = Math.round(preRound);
    const roundOff = Math.round((gTotal - preRound) * 100) / 100;
    const cgst = gst / 2;
    const sgst = gst / 2;

    return { subtotal, gst, cgst, sgst, preRound, roundOff, gTotal };
  }, [items, discount, oldGoldAmount, isGst]);

  const reset = () => {
    setEditingId(null);
    setItems([]);
    setDiscount("");
    setOldGoldAmount("");
    setCustomerId("");
    setCashAmount("");
    setOnlineAmount("");
    setOnlineMode("UPI");
    setCustomerSignature("");
    setAuthorizedSignatory("");
  };

  const editInvoice = (inv: any) => {
    setEditingId(inv._id || inv.id);
    setType(inv.type);
    setCustomerId(inv.customerId);
    setSearchCust(inv.customerName || "");
    setItems(inv.items || []);
    setDiscount(inv.discount || "");
    setOldGoldAmount(inv.oldGoldAmount || "");
    
    let cAmt = 0;
    let oAmt = 0;
    let oMode = "UPI";

    if (inv.payments && inv.payments.length > 0) {
      inv.payments.forEach((p: any) => {
        if (p.mode === "Cash") cAmt += p.amount;
        else { oAmt += p.amount; oMode = p.mode; }
      });
    } else {
      const paid = inv.amountPaid !== undefined ? inv.amountPaid : inv.total;
      if (inv.paymentMode === "Cash") { cAmt = paid; }
      else { oAmt = paid; oMode = inv.paymentMode || "UPI"; }
    }
    
    if (cAmt === 0 && oAmt === 0) {
      setCashAmount(0);
      setOnlineAmount("");
    } else {
      setCashAmount(cAmt > 0 ? cAmt : "");
      setOnlineAmount(oAmt > 0 ? oAmt : "");
    }
    setOnlineMode(oMode);
    
    setCustomerSignature(inv.customerSignature || "");
    setAuthorizedSignatory(inv.authorizedSignatory || "");
    setOpen(true);
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

    const existingInv = editingId ? invoices.find(i => (i._id || i.id) === editingId) : null;

    const isCashEmpty = cashAmount === "";
    const isOnlineEmpty = onlineAmount === "";
    const cAmt = Number(cashAmount) || 0;
    const oAmt = Number(onlineAmount) || 0;
 
    let safeActualPaid = 0;
    let finalPaymentMode = "Cash";
    const initialPayment: any[] = [];
 
    if (isCashEmpty && isOnlineEmpty) {
      if (editingId) {
        safeActualPaid = 0;
        finalPaymentMode = "Cash";
      } else {
        safeActualPaid = totals.gTotal;
        finalPaymentMode = "Cash";
        if (safeActualPaid > 0) {
          initialPayment.push({ date: new Date().toISOString(), amount: safeActualPaid, mode: "Cash", note: "Initial Payment" });
        }
      }
    } else {
      safeActualPaid = cAmt + oAmt;
      finalPaymentMode = oAmt > cAmt ? onlineMode : "Cash";
 
      if (cAmt > 0) initialPayment.push({ date: new Date().toISOString(), amount: cAmt, mode: "Cash", note: "Initial Cash Payment" });
      if (oAmt > 0) initialPayment.push({ date: new Date().toISOString(), amount: oAmt, mode: onlineMode, note: `Initial ${onlineMode} Payment` });
    }
    const balanceDue = totals.gTotal - safeActualPaid;

    // Clean _id from subdocuments to avoid Mongoose immutable _id CastErrors on update
    const cleanItems = items.map((it: any) => {
      const { _id, id, ...rest } = it;
      return rest;
    });

    let cleanPayments = initialPayment;
    if (existingInv && Array.isArray(existingInv.payments) && existingInv.payments.length > 0) {
      // Re-sync historical date but overwrite amounts based on current edit form to guarantee accuracy
      const oldFirstDate = existingInv.payments[0].date || existingInv.createdAt;
      initialPayment.forEach(p => p.date = oldFirstDate);
      cleanPayments = initialPayment;
    }

    const inv: any = {
      number: existingInv ? existingInv.number : "INV-" + (invoices.length + 1).toString().padStart(4, "0"),
      type,
      customerId: cust?._id || cust?.id,
      customerName: cust?.name,
      customerMobile: cust?.mobile || cust?.phone || "",
      customerAddress: cust?.address || "",
      items: cleanItems,
      discount: Number(discount) || 0,
      oldGoldAmount: Number(oldGoldAmount) || 0,
      paymentMode: finalPaymentMode,
      subtotal: totals.subtotal,
      gstAmount: totals.gst,
      total: totals.gTotal,
      amountPaid: safeActualPaid,
      balanceDue,
      payments: cleanPayments,
      customerSignature,
      authorizedSignatory,
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: inv });
        toast.success("Invoice updated successfully");
      } else {
        const saved = await createMutation.mutateAsync(inv);
        
        // Deduct sold quantities from inventory stock
        for (const item of items) {
          const p = products.find((x) => (x.id || x._id) === item.productId);
          if (p) {
            const newStock = Math.max(0, (p.stock || 0) - (item.qty || 1));
            await updateProductMutation.mutateAsync({ id: p._id || p.id, body: { ...p, stock: newStock } });
          }
        }
        
        setViewing(saved);
        toast.success("Invoice generated successfully");
      }
      reset();
      setOpen(false);
    } catch (e) {
      toast.error("Failed to save invoice");
    }
  };

  const removeInvoice = async (invoice: Invoice) => {
    if (window.confirm(`Are you sure you want to delete Invoice ${invoice.number}? This will also add the sold items back to your inventory.`)) {
      try {
        // Add stock back to inventory
        for (const item of invoice.items) {
          const p = products.find((x) => (x.id || x._id) === item.productId);
          if (p) {
            const newStock = (p.stock || 0) + (item.qty || 1);
            await updateProductMutation.mutateAsync({ id: p._id || p.id, body: { ...p, stock: newStock } });
          }
        }
        await deleteMutation.mutateAsync(invoice._id || invoice.id || "");
        toast.success("Invoice deleted and stock restored.");
      } catch (e) { toast.error("Failed to delete invoice."); }
    }
  };

  const today = new Date().toDateString();
  const todayInvoices = invoices.filter(i => new Date(i.createdAt).toDateString() === today);
  const todayRevenue = todayInvoices.reduce((s, i) => s + i.total, 0);

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl">Billing & Invoices</h1>
          <p className="text-muted-foreground mt-1">Manage sales invoices and point-of-sale.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="w-full sm:w-auto" onClick={() => reset()}>
              <Plus className="w-4 h-4 mr-2" /> New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] lg:max-w-5xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-display">{editingId ? "Edit Invoice" : "Create Invoice"}</DialogTitle>
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
                <div className="flex flex-col sm:flex-row gap-3 w-full items-start sm:items-center">
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
                              <SelectItem key={p._id || p.id} value={p._id || p.id} disabled={p.stock <= 0}>
                                {p.name} · {p.barcode || p.huid || p.purity} · {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" variant="secondary" onClick={addCustomItem} className="shrink-0">
                      <Plus className="w-4 h-4 mr-2" /> Add Custom Item
                    </Button>
                </div>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">
                      Add products from the dropdown to start billing.
                    </p>
                  ) : (
                    <div className="overflow-x-auto w-full border border-border rounded-md">
                      <table className="w-full text-sm min-w-200">
                      <thead className="text-left text-muted-foreground border-b bg-muted/20">
                        <tr>
                          <th className="p-3 font-medium">Product</th>
                          <th className="py-3 font-medium w-24">Qty</th>
                          <th className="py-3 font-medium w-28">Net Wt (g)</th>
                          <th className="py-3 font-medium w-28">Rate (₹/g)</th>
                          <th className="py-3 font-medium w-28">Amount</th>
                          <th className="py-3 font-medium w-20">Making (%)</th>
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
                              <td className="p-3 min-w-40 space-y-2">
                                <Input value={it.name} onChange={(e) => updateItem(i, { name: e.target.value })} className="h-8 text-sm font-medium" placeholder="Item Name" />
                                <Input value={it.purity} onChange={(e) => updateItem(i, { purity: e.target.value })} className="h-7 text-xs" placeholder="Purity (e.g. 22K)" />
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
                                v={it.makingChargePct || (it.makingCharge > 0 && it.netWeight > 0 && it.ratePerGram > 0 ? Number(((it.makingCharge / (it.netWeight * it.ratePerGram)) * 100).toFixed(2)) : 0)}
                                on={(v) => {
                                  const amt = it.netWeight * it.ratePerGram;
                                  updateItem(i, { makingChargePct: v, makingCharge: (amt * v) / 100 });
                                }}
                                className="w-16 h-8 bg-background"
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
                    </div>
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
                      <Input type="number" className="w-32 h-8 text-right bg-background" value={discount} onChange={(e) => setDiscount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0" />
                    </div>
                    
                    <div className="flex items-center justify-between gap-4">
                      <Label className="text-muted-foreground font-normal">Old Gold (₹)</Label>
                      <Input type="number" className="w-32 h-8 text-right bg-background" value={oldGoldAmount} onChange={(e) => setOldGoldAmount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0" />
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
                        <Label className="text-muted-foreground font-normal">Cash Amount</Label>
                        <Input type="number" className="w-32 h-8 text-right bg-background" value={cashAmount} onChange={(e) => setCashAmount(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)} placeholder={editingId ? "0" : `${totals.gTotal}`} />
                      </div>
                      
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <Label className="text-muted-foreground font-normal">Online Amount</Label>
                          <Select value={onlineMode} onValueChange={setOnlineMode}>
                            <SelectTrigger className="w-24 h-8 bg-background text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(["UPI", "Card", "Bank", "EMI"] as const).map((m) => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input type="number" className="w-32 h-8 text-right bg-background" value={onlineAmount} onChange={(e) => setOnlineAmount(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)} placeholder="0" />
                      </div>

                      {(() => {
                        const currentPaid = (cashAmount === "" && onlineAmount === "") ? totals.gTotal : (Number(cashAmount) || 0) + (Number(onlineAmount) || 0);
                        const currentDue = totals.gTotal - currentPaid;
                        return (
                          <Row 
                            label="Balance Due" 
                            v={inr(currentDue)} 
                            valueClassName={currentDue > 0 ? "text-rose-600" : "text-green-600"}
                          />
                        );
                      })()}
                    </div>
                    
                    <div className="bg-muted/40 p-4 rounded-lg border border-border mt-4">
                      <Label className="text-muted-foreground font-normal block mb-3">Signatures (Optional)</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Customer Signature</Label>
                          <Input type="file" accept="image/*" className="bg-background mt-1" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => setCustomerSignature(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }} />
                          {customerSignature && <img src={customerSignature} alt="Customer Signature" className="mt-2 h-16 object-contain" />}
                        </div>
                        <div>
                          <Label className="text-xs">Authorized Signatory</Label>
                          <Input type="file" accept="image/*" className="bg-background mt-1" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => setAuthorizedSignatory(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }} />
                          {authorizedSignatory && <img src={authorizedSignatory} alt="Authorized Signatory" className="mt-2 h-16 object-contain" />}
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="w-full mt-2" size="lg" disabled={items.length === 0 || !customerId}>
                      <Plus className="w-4 h-4 mr-2" /> {editingId ? "Save Changes" : "Generate Invoice"}
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
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b bg-muted/20">
                    <tr>
                  <th className="p-3 font-medium">Invoice</th>
                  <th className="font-medium">Date</th>
                  <th className="font-medium">Customer</th>
                  <th className="font-medium">Type</th>
                  <th className="font-medium">Mode</th>
                  <th className="text-right font-medium">Total</th>
                  <th className="text-right font-medium">Due</th>
                  <th className="text-center font-medium">Status</th>
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
                    <td className="text-right font-medium text-rose-600">{inr(i.balanceDue || 0)}</td>
                    <td className="text-center">
                      {(i.balanceDue || 0) <= 0 ? (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">Paid</span>
                      ) : (
                        <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">Due</span>
                      )}
                    </td>
                        <td>
                      <div className="flex justify-end gap-2 pr-3">
                        <Button size="sm" variant="outline" onClick={() => setViewing(i)}>View</Button>
                            <Button size="icon" variant="ghost" onClick={() => editInvoice(i)}>
                              <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => removeInvoice(i)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
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

function InvoiceModal({ inv, onClose }: { inv: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-start p-2 sm:p-4 print:bg-white print:p-0 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-xl print:shadow-none print:max-w-none text-slate-900 my-auto relative">
        <div className="p-6 sm:p-10 print:p-0 border-2 border-transparent print:border-none m-2 print:m-0 bg-white">
          
          <ShopHeader documentLabel={inv.type === "GST" ? "Tax Invoice" : "Invoice"} />

          {/* Invoice Meta & Customer Details */}
          <div className="flex justify-between items-start mb-6 text-sm">
            <div>
              <div className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-1">Billed To:</div>
              <div className="font-bold text-lg">{inv.customerName}</div>
              <div className="text-slate-700">{inv.customerMobile}</div>
              <div className="max-w-62.5 mt-1 text-slate-700">{inv.customerAddress || "Address not provided"}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-display font-bold mb-2 text-slate-900">{inv.type === "GST" ? "TAX INVOICE" : "INVOICE"}</div>
              <table className="ml-auto text-left text-slate-700">
                <tbody>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Invoice No:</td><td className="font-semibold text-slate-900">{inv.number}</td></tr>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Date:</td><td className="font-semibold text-slate-900">{formatDate(inv.createdAt)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-sm mb-6 border-collapse border border-slate-300">
            <thead className="bg-slate-100">
              <tr>
                <th className="border border-slate-300 py-2 px-3 text-center w-12 text-slate-600">#</th>
                <th className="border border-slate-300 py-2 px-3 text-left text-slate-600">Description of Goods</th>
                <th className="border border-slate-300 py-2 px-3 text-right text-slate-600">Qty</th>
                <th className="border border-slate-300 py-2 px-3 text-right text-slate-600">Net Wt</th>
                <th className="border border-slate-300 py-2 px-3 text-right text-slate-600">Rate/g</th>
                <th className="border border-slate-300 py-2 px-3 text-right text-slate-600">Amount</th>
                <th className="border border-slate-300 py-2 px-3 text-right text-slate-600">Making (%)</th>
                <th className="border border-slate-300 py-2 px-3 text-right text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it: any, i: number) => {
                const c = calcItem(it, inv.type === "GST");
                const amount = it.netWeight * it.ratePerGram;
                return (
                  <tr key={i} className="border-b border-slate-300 last:border-0">
                    <td className="border border-slate-300 py-2 px-3 text-center text-slate-600">{i + 1}</td>
                    <td className="border border-slate-300 py-2 px-3">
                      <div className="font-semibold">{it.name}</div>
                      <div className="text-xs text-slate-500">Purity: {it.purity}</div>
                    </td>
                    <td className="border border-slate-300 py-2 px-3 text-right">{it.qty}</td>
                    <td className="border border-slate-300 py-2 px-3 text-right">{it.netWeight} g</td>
                    <td className="border border-slate-300 py-2 px-3 text-right">{inr(it.ratePerGram)}</td>
                    <td className="border border-slate-300 py-2 px-3 text-right">{inr(amount)}</td>
                    <td className="border border-slate-300 py-2 px-3 text-right">
                      {(() => {
                        const pct = it.makingChargePct || (it.makingCharge > 0 && it.netWeight > 0 && it.ratePerGram > 0 ? (it.makingCharge / (it.netWeight * it.ratePerGram)) * 100 : 0);
                        return pct > 0 ? `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%` : '0%';
                      })()}
                    </td>
                    <td className="border border-slate-300 py-2 px-3 text-right font-bold">{inr(c.line)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Calculations & Totals */}
          <div className="flex flex-col sm:flex-row justify-between items-start text-sm gap-6">
            <div className="w-full sm:w-1/2 sm:pr-8 order-2 sm:order-1">
               <InvoiceTerms />
               
              {((inv.balanceDue || 0) <= 0) && (
                <div className="mt-4 p-2 bg-green-50 border border-green-200 text-green-800 text-center font-bold rounded tracking-widest text-lg">
                  PAYMENT DONE
                </div>
              )}
            </div>
            <div className="w-full sm:w-1/2 max-w-sm order-1 sm:order-2">
              <table className="w-full">
                <tbody>
                  <tr><td className="py-1 text-slate-600">Subtotal</td><td className="py-1 text-right font-semibold">{inr(inv.subtotal)}</td></tr>
                  {inv.discount > 0 && <tr><td className="py-1 text-slate-600">Discount</td><td className="py-1 text-right font-semibold text-green-600">- {inr(inv.discount)}</td></tr>}
                  {inv.oldGoldAmount > 0 && <tr><td className="py-1 text-slate-600">Old Gold Exchange</td><td className="py-1 text-right font-semibold text-green-600">- {inr(inv.oldGoldAmount)}</td></tr>}
                  {inv.type === "GST" && (
                    <>
                      <tr><td className="py-1 text-slate-600">CGST</td><td className="py-1 text-right font-semibold">{inr(inv.gstAmount / 2)}</td></tr>
                      <tr><td className="py-1 text-slate-600">SGST</td><td className="py-1 text-right font-semibold">{inr(inv.gstAmount / 2)}</td></tr>
                    </>
                  )}
                  {(() => {
                    const preRound = Math.round((inv.subtotal - inv.discount - inv.oldGoldAmount + (inv.type === "GST" ? inv.gstAmount : 0)) * 100) / 100;
                    const roundOff = Math.round((inv.total - preRound) * 100) / 100;
                    return roundOff !== 0 ? <tr><td className="py-1 text-slate-600">Round Off</td><td className="py-1 text-right font-semibold">{inr(roundOff)}</td></tr> : null;
                  })()}
                  <tr className="border-t-2 border-slate-300 text-lg">
                    <td className="py-2 font-bold text-slate-900">Grand Total</td>
                    <td className="py-2 text-right font-bold text-slate-900">{inr(inv.total)}</td>
                  </tr>
                  {inv.amountPaid !== undefined && (
                    <>
                      {(() => {
                        if (inv.payments && inv.payments.length > 0) {
                          const cashPaid = inv.payments.filter((p: any) => p.mode === "Cash").reduce((s: number, p: any) => s + p.amount, 0);
                          const onlinePaid = inv.payments.filter((p: any) => p.mode !== "Cash").reduce((s: number, p: any) => s + p.amount, 0);
                          return (
                            <>
                              {cashPaid > 0 && (
                                <tr className="border-t border-slate-200">
                                  <td className="py-1 text-slate-600">Paid (Cash)</td>
                                  <td className="py-1 text-right font-medium text-green-700">{inr(cashPaid)}</td>
                                </tr>
                              )}
                              {onlinePaid > 0 && (
                                <tr className={cashPaid > 0 ? "" : "border-t border-slate-200"}>
                                  <td className="py-1 text-slate-600">Paid (Online)</td>
                                  <td className="py-1 text-right font-medium text-green-700">{inr(onlinePaid)}</td>
                                </tr>
                              )}
                              {cashPaid > 0 && onlinePaid > 0 && (
                                <tr>
                                  <td className="py-1.5 font-bold text-slate-800">Total Paid</td>
                                  <td className="py-1.5 text-right font-bold text-green-700">{inr(inv.amountPaid)}</td>
                                </tr>
                              )}
                            </>
                          );
                        }
                        return (
                          <tr className="border-t border-slate-200">
                            <td className="py-1.5 text-slate-600">Amount Paid {inv.paymentMode && !inv.paymentMode.includes("+") ? `(${inv.paymentMode})` : ""}</td>
                            <td className="py-1.5 text-right font-semibold text-green-700">{inr(inv.amountPaid)}</td>
                          </tr>
                        );
                      })()}
                      <tr>
                        <td className="py-1.5 font-bold">Balance Due</td>
                        <td className="py-1.5 text-right font-bold text-rose-700">{inr(inv.balanceDue || 0)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 flex justify-center border-t border-slate-200 pt-5">
            <PaymentQr amount={inv.balanceDue || 0} />
          </div>

          {/* Signatures */}
          <div className="mt-16 flex justify-between items-end text-xs font-bold text-slate-500 uppercase tracking-wider">
            <div className="text-center">
              {inv.customerSignature ? (
                <img src={inv.customerSignature} alt="Customer Signature" className="h-16 mx-auto mb-2 object-contain" />
              ) : (
                <div className="w-48 border-t-2 border-slate-300 mb-2 mx-auto"></div>
              )}
              Customer Signature
            </div>
            <div className="text-center">
              {inv.authorizedSignatory ? (
                <img src={inv.authorizedSignatory} alt="Authorized Signatory" className="h-16 mx-auto mb-2 object-contain" />
              ) : (
                <div className="w-48 border-t-2 border-slate-300 mb-2 mx-auto"></div>
              )}
              Authorized Signatory
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-slate-100 p-4 border-t border-slate-200 rounded-b-lg flex justify-end gap-3 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print Bill
          </Button>
        </div>
      </div>
    </div>
  );
}
