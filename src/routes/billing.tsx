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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useMemo, useState } from "react";
import { Plus, Trash2, Printer } from "lucide-react";
import {
  useLocalState,
  uid,
  inr,
  calcItem,
  type Invoice,
  type InvoiceItem,
  type Product,
  type Customer,
} from "@/lib/storage";
import { formatDate } from "@/lib/utils";

export default function BillingPage() {
  const [invoices, setInvoices] = useLocalState<Invoice[]>("ajms.invoices", []);
  const [products] = useLocalState<Product[]>("ajms.products", []);
  const [customers] = useLocalState<Customer[]>("ajms.customers", []);
  const [viewing, setViewing] = useState<Invoice | null>(null);

  const [type, setType] = useState<"GST" | "NON-GST">("GST");
  const [customerId, setCustomerId] = useState<string>("");
  const [walkInName, setWalkInName] = useState("");
  const [walkInMobile, setWalkInMobile] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [oldGoldAmount, setOldGoldAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<Invoice["paymentMode"]>("Cash");

  const isGst = type === "GST";

  const addProduct = (pid: string) => {
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    setItems((prev) => [
      ...prev,
      {
        productId: p.id,
        name: p.name,
        purity: p.purity,
        netWeight: p.netWeight,
        ratePerGram: p.ratePerGram,
        makingCharge: p.makingCharge,
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
    const total = afterAdj + gst;
    return { subtotal, gst, total };
  }, [items, discount, oldGoldAmount, isGst]);

  const reset = () => {
    setItems([]);
    setDiscount(0);
    setOldGoldAmount(0);
    setCustomerId("");
    setWalkInName("");
    setWalkInMobile("");
  };

  const save = () => {
    if (items.length === 0) return;
    const cust = customers.find((c) => c.id === customerId);
    const inv: Invoice = {
      id: uid(),
      number: "INV-" + (invoices.length + 1).toString().padStart(4, "0"),
      type,
      customerId: cust?.id,
      customerName: cust?.name || walkInName || "Walk-in",
      customerMobile: cust?.mobile || walkInMobile,
      items,
      discount,
      oldGoldAmount,
      paymentMode,
      subtotal: totals.subtotal,
      gstAmount: totals.gst,
      total: totals.total,
      createdAt: new Date().toISOString(),
    };
    console.log("[Billing] Warning: Saving to local storage (Not DB!):", inv);
    setInvoices((prev) => [inv, ...prev]);
    setViewing(inv);
    reset();
    console.log("[Billing] Local storage update complete.");
  };

  return (
    <Layout>
      <header className="mb-6">
        <h1 className="text-4xl">Billing</h1>
        <p className="text-muted-foreground mt-1">Create invoices and view history.</p>
      </header>

      <Tabs defaultValue="new">
        <TabsList>
          <TabsTrigger value="new">New Invoice</TabsTrigger>
          <TabsTrigger value="history">History ({invoices.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-display">Customer & Type</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Invoice Type</Label>
                    <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GST">GST Invoice</SelectItem>
                        <SelectItem value="NON-GST">Non-GST Invoice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Customer</Label>
                    <Select value={customerId || "walkin"} onValueChange={(v) => setCustomerId(v === "walkin" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Walk-in" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="walkin">Walk-in customer</SelectItem>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} · {c.mobile}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!customerId && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Walk-in Name</Label>
                        <Input value={walkInName} onChange={(e) => setWalkInName(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Walk-in Mobile</Label>
                        <Input value={walkInMobile} onChange={(e) => setWalkInMobile(e.target.value)} />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="font-display">Items</CardTitle>
                  <div className="w-72">
                    <Select value="" onValueChange={addProduct}>
                      <SelectTrigger>
                        <SelectValue placeholder={products.length ? "Add product…" : "No products in inventory"} />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} · {p.purity} · {inr(p.ratePerGram)}/g
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">
                      Add products from the dropdown to start billing.
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="text-left text-muted-foreground border-b">
                        <tr>
                          <th className="p-3">Item</th>
                          <th>Net Wt</th>
                          <th>Rate/g</th>
                          <th>Making</th>
                          <th>Stone</th>
                          <th>Qty</th>
                          <th className="text-right pr-3">Line</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, i) => {
                          const c = calcItem(it, isGst);
                          return (
                            <tr key={i} className="border-b last:border-0">
                              <td className="p-2">
                                <div className="font-medium">{it.name}</div>
                                <div className="text-xs text-muted-foreground">{it.purity}</div>
                              </td>
                              <td><NumI v={it.netWeight} on={(v) => updateItem(i, { netWeight: v })} /></td>
                              <td><NumI v={it.ratePerGram} on={(v) => updateItem(i, { ratePerGram: v })} /></td>
                              <td><NumI v={it.makingCharge} on={(v) => updateItem(i, { makingCharge: v })} /></td>
                              <td><NumI v={it.stoneCharge} on={(v) => updateItem(i, { stoneCharge: v })} /></td>
                              <td><NumI v={it.qty} on={(v) => updateItem(i, { qty: v })} /></td>
                              <td className="text-right pr-3">{inr(c.line)}</td>
                              <td>
                                <Button size="icon" variant="ghost" onClick={() => removeItem(i)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="font-display">Summary</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Row label="Subtotal" v={inr(totals.subtotal)} />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Discount (₹)</Label>
                    <Input type="number" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Old Gold Exchange (₹)</Label>
                    <Input type="number" value={oldGoldAmount} onChange={(e) => setOldGoldAmount(parseFloat(e.target.value) || 0)} />
                  </div>
                  {isGst && <Row label="GST" v={inr(totals.gst)} />}
                  <div className="border-t pt-3 flex justify-between font-display text-lg">
                    <span>Total</span>
                    <span>{inr(totals.total)}</span>
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <Label className="text-xs">Payment Mode</Label>
                    <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as Invoice["paymentMode"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["Cash", "UPI", "Card", "EMI"] as const).map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" size="lg" onClick={save} disabled={items.length === 0}>
                    <Plus className="w-4 h-4 mr-2" /> Generate Invoice
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">No invoices yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b">
                    <tr>
                      <th className="p-3">Invoice</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Type</th>
                      <th>Mode</th>
                      <th className="text-right">Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((i) => (
                      <tr key={i.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="p-3 font-medium">{i.number}</td>
                        <td>{formatDate(i.createdAt)}</td>
                        <td>{i.customerName}</td>
                        <td>{i.type}</td>
                        <td>{i.paymentMode}</td>
                        <td className="text-right">{inr(i.total)}</td>
                        <td>
                          <div className="flex justify-end pr-3">
                            <Button size="sm" variant="ghost" onClick={() => setViewing(i)}>View</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {viewing && <InvoiceModal inv={viewing} onClose={() => setViewing(null)} />}
    </Layout>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{v}</span>
    </div>
  );
}

function NumI({ v, on }: { v: number; on: (n: number) => void }) {
  return (
    <Input
      type="number"
      className="w-24 h-8"
      value={v}
      onChange={(e) => on(parseFloat(e.target.value) || 0)}
    />
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
              <th className="py-2">Item</th>
              <th>Wt</th>
              <th>Rate</th>
              <th>Mk</th>
              <th>Qty</th>
              <th className="text-right">Amt</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => {
              const c = calcItem(it, inv.type === "GST");
              return (
                <tr key={i} className="border-b">
                  <td className="py-2">
                    {it.name}
                    <span className="text-xs text-muted-foreground"> · {it.purity}</span>
                  </td>
                  <td>{it.netWeight}g</td>
                  <td>{inr(it.ratePerGram)}</td>
                  <td>{inr(it.makingCharge)}</td>
                  <td>{it.qty}</td>
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
          {inv.type === "GST" && <Row label="GST" v={inr(inv.gstAmount)} />}
          <div className="border-t pt-2 flex justify-between font-display text-lg">
            <span>Total</span>
            <span>{inr(inv.total)}</span>
          </div>
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
