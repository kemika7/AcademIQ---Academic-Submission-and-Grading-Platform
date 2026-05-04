"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GraduationCap, ShieldCheck, Sparkles, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { login } from "@/lib/api/auth";
import { clearTokens, getSessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

type LoginRole = "student" | "instructor" | "admin";

const ROLE_TABS: Array<{ value: LoginRole; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "student", label: "Student", icon: GraduationCap },
  { value: "instructor", label: "Instructor", icon: UserCog },
  { value: "admin", label: "Admin", icon: ShieldCheck },
];

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<LoginRole>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => { clearTokens(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      const user = getSessionUser();
      if (user && user.role !== selectedRole) {
        setError(`This account is a ${user.role}, not a ${selectedRole}. Switch the tab to match, or sign in with the right account.`);
        setLoading(false);
        return;
      }
      router.push(user?.role === "admin" ? "/admin" : "/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Link href="/" className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" /> AcademIQ
          </Link>
          <CardTitle>Welcome back</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-3 gap-1 rounded-md border p-1">
            {ROLE_TABS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setSelectedRole(value); setError(null); }}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium capitalize transition-colors",
                  selectedRole === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Password</label>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : `Sign in as ${selectedRole}`}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            New here? <Link href="/register" className="text-primary hover:underline">Create an account</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
