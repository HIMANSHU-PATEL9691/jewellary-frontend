import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { inr, type MetalRates } from "@/lib/storage";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { goldRatesAPI } from "@/lib/api";
import { TrendingUp } from "lucide-react";

const defaultRates: MetalRates = {
  updatedAt: new Date().toISOString(),
  gold24: 7850,
  gold22: 7200,
  gold18: 5890,
  silver: 98,
};

export default function GoldRatesPage() {
  const { data = [], isLoading, error } = useApi<MetalRates[]>(["goldRates"], () => goldRatesAPI.getAll());
  const createMutation = useApiMutation((data: MetalRates) => goldRatesAPI.create(data), ["goldRates"]);
  const updateMutation = useApiMutation(
    (data: { id: string; body: MetalRates }) => goldRatesAPI.update(data.id, data.body),
    ["goldRates"]
  );

  const latest = data[0];
  const [open, setOpen] = useState(false);
  const [rates, setRates] = useState<MetalRates>(defaultRates);

  useEffect(() => {
    if (latest) {
      setRates({
        updatedAt: latest.updatedAt ?? new Date().toISOString(),
        gold24: latest.gold24,
        gold22: latest.gold22,
        gold18: latest.gold18,
        silver: latest.silver,
      });
    }
  }, [latest]);

  const saveRate = async (key: keyof MetalRates, value: number) => {
    const nextRates = { ...rates, [key]: value, updatedAt: new Date().toISOString() };
    setRates(nextRates);

    console.log(`[Gold Rates] Saving rate to DB | ${key}: ${value}`, nextRates);
    if (latest && (latest as any)._id) {
      await updateMutation.mutateAsync({ id: (latest as any)._id, body: nextRates });
    } else {
      await createMutation.mutateAsync(nextRates);
    }
    console.log(`[Gold Rates] Successfully updated DB!`);
  };

  const markUpdatedNow = async () => {
    const nextRates = { ...rates, updatedAt: new Date().toISOString() };
    setRates(nextRates);
    if (latest && (latest as any)._id) {
      await updateMutation.mutateAsync({ id: (latest as any)._id, body: nextRates });
    } else {
      await createMutation.mutateAsync(nextRates);
    }
  };

  const cards = [
    { key: "gold24" as const, label: "24K Gold", tone: "from-yellow-100 to-yellow-50" },
    { key: "gold22" as const, label: "22K Gold", tone: "from-amber-100 to-amber-50" },
    { key: "gold18" as const, label: "18K Gold", tone: "from-orange-100 to-orange-50" },
    { key: "silver" as const, label: "Silver", tone: "from-slate-100 to-slate-50" },
  ];

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Gold & Silver Rates</h1>
          <p className="text-muted-foreground mt-1">Set today's per-gram rates. Used in billing & advances.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg">Edit Rates</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[75vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update Metal Rates</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {cards.map((c) => (
                <div key={c.key}>
                  <Label className="text-xs">{c.label} (₹/g)</Label>
                  <Input type="number" value={rates[c.key] as number} onChange={(e) => saveRate(c.key, +e.target.value)} />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              {isLoading ? 'Loading rates...' : error ? 'Failed to load rates' : `Updated: ${formatDate(rates.updatedAt)}`}
              <Button onClick={markUpdatedNow}>Save Rates</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Card key={c.key} className={`bg-linear-to-br ${c.tone}`}>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground flex items-center gap-1"><TrendingUp className="w-4 h-4" />{c.label}</div>
              <div className="text-3xl font-display mt-1">{inr(rates[c.key] as number)}<span className="text-base text-muted-foreground">/g</span></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display">Update Rates</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Use the <strong>Edit Rates</strong> button in the top right to update the current gold and silver rates.
        </CardContent>
      </Card>
    </Layout>
  );
}
