"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, type LucideIcon, Plus, Search, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  createAdminUser, deleteAdminUser, listAdminUsers, updateAdminUser, type AdminUser,
} from "@/lib/api/admin";
import { getSessionUser } from "@/lib/auth/session";
import { formatRelative } from "@/lib/utils";

const ROLES = ["student", "instructor", "admin"] as const;
type RoleTab = (typeof ROLES)[number];

const ROLE_TABS: Array<{ value: RoleTab; label: string; icon: LucideIcon }> = [
  { value: "student", label: "Students", icon: GraduationCap },
  { value: "instructor", label: "Instructors", icon: UserCog },
  { value: "admin", label: "Admins", icon: ShieldCheck },
];

const ROLE_BADGE: Record<string, "default" | "secondary" | "success" | "warning"> = {
  student: "secondary",
  instructor: "default",
  admin: "success",
};

export default function AdminUsersPage() {
  const me = getSessionUser();
  const router = useRouter();

  useEffect(() => {
    if (me && me.role !== "admin") router.replace("/dashboard");
  }, [me, router]);

  const [search, setSearch] = useState("");
  const [roleTab, setRoleTab] = useState<RoleTab>("student");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", { role: roleTab, search }],
    queryFn: () => listAdminUsers({
      role: roleTab,
      ...(search ? { search } : {}),
    }),
  });

  const { data: allUsers } = useQuery({
    queryKey: ["admin-users", "all"],
    queryFn: () => listAdminUsers(),
  });

  const counts = {
    student: allUsers?.filter((u) => u.role === "student").length ?? 0,
    instructor: allUsers?.filter((u) => u.role === "instructor").length ?? 0,
    admin: allUsers?.filter((u) => u.role === "admin").length ?? 0,
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <UserCog className="h-5 w-5" /> Users
          </h1>
          <p className="text-sm text-muted-foreground">Create accounts, change roles, deactivate users.</p>
        </div>
        <CreateUserButton />
      </div>

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-md border p-1">
        {ROLE_TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setRoleTab(value)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
              roleTab === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            <Badge
              variant={roleTab === value ? "secondary" : "outline"}
              className={cn("ml-1", roleTab === value && "bg-primary-foreground/20 text-primary-foreground border-transparent")}
            >
              {counts[value]}
            </Badge>
          </button>
        ))}
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${ROLE_TABS.find((t) => t.value === roleTab)?.label.toLowerCase()} by name or email…`}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ROLE_TABS.find((t) => t.value === roleTab)?.icon ?? UserCog}
          title={search ? "No matches" : `No ${roleTab}s yet`}
          body={search ? "Try a different search term." : "Create one with the New user button."}
        />
      ) : (
        <Card className="divide-y overflow-hidden">
          {data.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              currentUserId={me?.id ?? -1}
              onChange={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
            />
          ))}
        </Card>
      )}
    </div>
  );
}

function UserRow({
  user, currentUserId, onChange,
}: { user: AdminUser; currentUserId: number; onChange: () => void }) {
  const isSelf = user.id === currentUserId;

  const roleMut = useMutation({
    mutationFn: (role: AdminUser["role"]) => updateAdminUser(user.id, { role }),
    onSuccess: onChange,
  });
  const activeMut = useMutation({
    mutationFn: (is_active: boolean) => updateAdminUser(user.id, { is_active }),
    onSuccess: onChange,
  });
  const delMut = useMutation({
    mutationFn: () => deleteAdminUser(user.id),
    onSuccess: onChange,
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{user.full_name}</span>
          {isSelf && <Badge variant="secondary">you</Badge>}
          {!user.is_active && <Badge variant="warning">inactive</Badge>}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{user.email}</span>
          <span>·</span>
          <span>joined {formatRelative(user.created_at)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={user.role}
          onChange={(e) => roleMut.mutate(e.target.value as AdminUser["role"])}
          disabled={isSelf || roleMut.isPending}
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
          title={isSelf ? "Cannot change your own role" : "Change role"}
        >
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <Badge variant={ROLE_BADGE[user.role] ?? "secondary"} className="capitalize">
          <ShieldCheck className="h-3 w-3" /> {user.role}
        </Badge>
        <Button
          variant="ghost" size="sm"
          onClick={() => activeMut.mutate(!user.is_active)}
          disabled={isSelf || activeMut.isPending}
        >
          {user.is_active ? "Deactivate" : "Activate"}
        </Button>
        {!isSelf && (
          <DeleteDialog
            triggerLabel=""
            title={`Delete ${user.full_name}?`}
            description="This permanently removes the user account. Submissions and grades they created will lose their author reference (set to null) but remain in the system."
            confirmLabel="Delete user"
            onConfirm={() => delMut.mutateAsync()}
            variant="ghost"
          />
        )}
      </div>
    </div>
  );
}

function CreateUserButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("student");
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => createAdminUser({ email, full_name: fullName, password, role, is_active: true }),
    onSuccess: () => {
      setOpen(false);
      setEmail(""); setFullName(""); setPassword(""); setRole("student"); setError(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: any) => {
      const detail = e.response?.data;
      const msg = typeof detail === "string"
        ? detail
        : detail?.detail
          ?? Object.entries(detail ?? {}).map(([k, v]) => `${k}: ${(v as any).toString()}`).join("; ")
          ?? "Could not create user";
      setError(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> New user</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a user</DialogTitle>
          <DialogDescription>
            Set the initial password manually; the user can change it later.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); if (email && fullName && password) mut.mutate(); }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium">Full name</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Password</label>
            <Input
              type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8} required
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AdminUser["role"])}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={mut.isPending || !email || !fullName || !password}>
              {mut.isPending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
