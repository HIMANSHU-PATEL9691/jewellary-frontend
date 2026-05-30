import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gem, Lock } from "lucide-react";
import { toast } from "sonner";
import { karigarsAPI } from "@/lib/api";

export default function LoginPage({ onLogin }: { onLogin: (user: any) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Default Credentials (you can change these!)
    if (username === "admin" && password === "admin123") {
      toast.success("Welcome back Admin!");
      onLogin({ role: "admin" });
    } else {
      try {
        const karigars = await karigarsAPI.getAll();
        const match = karigars.find((k: any) => k.username === username && k.password === password);
        if (match) {
          toast.success(`Welcome ${match.name}!`);
          onLogin({ role: "karigar", id: match._id || match.id, name: match.name });
          return;
        }
      } catch (err) {
        console.error("Failed to fetch karigars for login check", err);
      }
      toast.error("Invalid username or password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto w-12 h-12 bg-primary text-primary-foreground rounded-xl flex items-center justify-center mb-4 shadow-sm">
            <Gem className="w-6 h-6" />
          </div>
          <CardTitle className="text-3xl font-display">Cloudiefy</CardTitle>
          <CardDescription className="text-base mt-2">Jewellery Management Software</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" type="text" placeholder="Enter admin username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" />
            </div>
            <Button type="submit" className="w-full h-11 text-base mt-2">
              <Lock className="w-4 h-4 mr-2" /> Secure Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}