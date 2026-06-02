import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr } from "@/lib/storage";
import { Calculator, RotateCcw, Scale, Coins, ArrowRightLeft } from "lucide-react";

export default function CalculatorPage() {
  // New Item States
  const [weight, setWeight] = useState<number | "">("");
  const [rate, setRate] = useState<number | "">("");
  const [making, setMaking] = useState<number | "">("");
  const [makingType, setMakingType] = useState<"percent" | "fixed">("percent");
  const [stone, setStone] = useState<number | "">("");
  const [gstType, setGstType] = useState<"GST" | "NON-GST">("GST");
  const [gst, setGst] = useState<number | "">(3);

  // Old Gold Exchange States
  const [oldGoldAmount, setOldGoldAmount] = useState<number | "">("");

  const calc = useMemo(() => {
    // New Item calculations
    const w = Number(weight) || 0;
    const r = Number(rate) || 0;
    const m = Number(making) || 0;
    const s = Number(stone) || 0;
    const g = gstType === "GST" ? (Number(gst) || 0) : 0;

    const metalValue = w * r;
    const makingValue = makingType === "percent" ? (metalValue * m) / 100 : m;
    const subtotal = metalValue + makingValue + s;
    const gstValue = (subtotal * g) / 100;
    const total = subtotal + gstValue;

    // Exchange calculations
    const exchangeValue = Number(oldGoldAmount) || 0;

    const payable = total - exchangeValue;

    return {
      metalValue,
      makingValue,
      subtotal,
      gstValue,
      total,
      exchangeValue,
      payable
    };
  }, [weight, rate, making, makingType, stone, gstType, gst, oldGoldAmount]);

  const reset = () => {
    setWeight("");
    setRate("");
    setMaking("");
    setMakingType("percent");
    setStone("");
    setGstType("GST");
    setGst(3);
    setOldGoldAmount("");
  };

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Jewelry Calculator</h1>
          <p className="text-muted-foreground mt-1">Quick estimates for new purchases and old gold exchange.</p>
        </div>
        <Button variant="outline" onClick={reset} className="h-10">
          <RotateCcw className="w-4 h-4 mr-2" /> Reset All
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Inputs */}
        <div className="lg:col-span-2 space-y-6">
          {/* New Item Calculator */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="font-display flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" /> New Item Calculator
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Net Weight (g)"><Input type="number" value={weight} onChange={e => setWeight(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0.000" /></F>
              <F label="Rate / gram (₹)"><Input type="number" value={rate} onChange={e => setRate(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 7200" /></F>
              
              <F label="Making Charge">
                <div className="flex gap-2">
                  <Select value={makingType} onValueChange={v => setMakingType(v as "percent" | "fixed")}>
                    <SelectTrigger className="w-24 shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">%</SelectItem>
                      <SelectItem value="fixed">Fixed ₹</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" value={making} onChange={e => setMaking(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0" className="flex-1" />
                </div>
              </F>
              
              <F label="Stone Charges (₹)"><Input type="number" value={stone} onChange={e => setStone(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0" /></F>
              <F label="Tax Options">
                <div className="flex gap-2">
                  <Select value={gstType} onValueChange={v => setGstType(v as "GST" | "NON-GST")}>
                    <SelectTrigger className="w-28 shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GST">GST</SelectItem>
                      <SelectItem value="NON-GST">Non-GST</SelectItem>
                    </SelectContent>
                  </Select>
                  {gstType === "GST" && (
                    <Input type="number" value={gst} onChange={e => setGst(e.target.value === "" ? "" : Number(e.target.value))} placeholder="3" className="flex-1" />
                  )}
                </div>
              </F>
            </CardContent>
          </Card>

          {/* Old Gold Calculator */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="font-display flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-rose-500" /> Old Gold Exchange
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <F label="Old Gold Amount (₹)"><Input type="number" value={oldGoldAmount} onChange={e => setOldGoldAmount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0" /></F>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Summary */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="font-display flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" /> Final Estimate
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">New Item</div>
                <Row label="Metal Value" v={inr(calc.metalValue)} />
                <Row label="Making Charges" v={inr(calc.makingValue)} />
                {Number(stone) > 0 && <Row label="Stone Charges" v={inr(Number(stone))} />}
                <Row label="Subtotal" v={inr(calc.subtotal)} />
                {gstType === "GST" && <Row label={`GST (${Number(gst)}%)`} v={inr(calc.gstValue)} />}
                <Row label="Total Item Value" v={inr(calc.total)} highlight />
              </div>

              {Number(oldGoldAmount) > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1"><Scale className="w-3.5 h-3.5"/> Exchange</div>
                  <Row label="Exchange Value" v={`- ${inr(calc.exchangeValue)}`} negative />
                </div>
              )}

              <div className="pt-4 border-t-2 border-border mt-2">
                <div className="flex justify-between items-center text-lg">
                  <span className="font-bold text-slate-900">Net Payable</span>
                  <span className={`font-display font-bold ${calc.payable < 0 ? "text-rose-600" : "text-green-600"}`}>
                    {inr(calc.payable)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
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

function Row({ label, v, highlight = false, negative = false }: { label: string; v: string; highlight?: boolean; negative?: boolean }) {
  return (
    <div className={`flex justify-between items-center ${highlight ? "font-bold text-base mt-2" : "text-sm"}`}>
      <span className={highlight ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={highlight ? "text-primary" : negative ? "text-green-600 font-medium" : "font-medium"}>{v}</span>
    </div>
  );
}