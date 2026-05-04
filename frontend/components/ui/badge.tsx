import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary border-primary/20",
        secondary: "bg-muted text-muted-foreground border-transparent",
        outline: "text-foreground",
        success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
        warning: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
        danger: "bg-destructive/10 text-destructive border-destructive/20",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
