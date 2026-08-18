import clsx from "clsx";

interface TypographyProps {
  children: React.ReactNode;
  className?: string;
}

export function H1({ children, className }: TypographyProps) {
  return <h1 className={clsx("text-xl font-semibold tracking-tight", className)}>{children}</h1>;
}

export function H2({ children, className }: TypographyProps) {
  return <h2 className={clsx("text-base font-semibold", className)}>{children}</h2>;
}

export function H3({ children, className }: TypographyProps) {
  return <h3 className={clsx("text-sm font-semibold", className)}>{children}</h3>;
}

export function H4({ children, className }: TypographyProps) {
  return <h4 className={clsx("text-base font-bold", className)}>{children}</h4>;
}

export function H5({ children, className }: TypographyProps) {
  return <h5 className={clsx("text-sm font-bold", className)}>{children}</h5>;
}

export function H6({ children, className }: TypographyProps) {
  return <h6 className={clsx("text-xs font-bold", className)}>{children}</h6>;
}

export function P({ children, className }: TypographyProps) {
  return <p className={clsx("text-sm", className)}>{children}</p>;
}

export function Span({ children, className }: TypographyProps) {
  return <span className={clsx("text-sm", className)}>{children}</span>;
}

export function Div({ children, className }: TypographyProps) {
  return <div className={clsx("text-sm", className)}>{children}</div>;
}
