"use client";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { clearTokens, type SessionUser } from "@/lib/auth/session";

export function Topbar({ user }: { user: SessionUser }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  function logout() {
    clearTokens();
    qc.clear();
    setOpen(false);
    router.replace("/");
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background/60 px-6 backdrop-blur">
      <div className="text-sm text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{user.full_name}</span>
        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs uppercase tracking-wide">{user.role}</span>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>
              You'll need to sign in again to continue working.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={logout}>Sign out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
