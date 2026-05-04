"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, GraduationCap, Inbox, LayoutDashboard, Sparkles, UserCog, Users, FolderKanban } from "lucide-react";
import type { Role } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const STUDENT_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/groups", label: "Groups", icon: Users },
];

const INSTRUCTOR_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/rubrics", label: "Grading", icon: ClipboardCheck },
];

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: UserCog },
  { href: "/admin/projects", label: "All Projects", icon: FolderKanban },
  ...INSTRUCTOR_NAV.filter((i) => i.href !== "/dashboard"),
];

export function Sidebar({ role }: { role: Role }) {
  const path = usePathname();
  const items = role === "admin" ? ADMIN_NAV : role === "instructor" ? INSTRUCTOR_NAV : STUDENT_NAV;
  return (
    <aside className="flex w-60 flex-col border-r bg-card/30 px-3 py-4">
      <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-primary" /> AcademIQ
      </Link>
      <nav className="space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const matchingHrefs = items
            .map((i) => i.href)
            .filter((h) => path === h || path.startsWith(h + "/"));
          const longest = matchingHrefs.sort((a, b) => b.length - a.length)[0];
          const active = href === longest;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-2 text-xs text-muted-foreground">
        <FolderKanban className="mb-1 h-3 w-3" /> v0.1.0
      </div>
    </aside>
  );
}
