import clsx from "clsx";

type CardVariant = "flat" | "bordered" | "subtle";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: CardVariant;
}

const VARIANT_MAP: Record<CardVariant, string> = {
  flat: "p-4 bg-base-100 text-base-content rounded-lg",
  bordered:
    "p-4 bg-base-100 text-base-content rounded-xl border border-base-200 shadow-sm hover:shadow-md transition-shadow",
  subtle: "p-4 bg-base-100/50 text-base-content rounded-lg border border-base-200/60",
};

export function Card({ children, className, variant = "flat" }: CardProps) {
  return <div className={clsx(VARIANT_MAP[variant], className)}>{children}</div>;
}
