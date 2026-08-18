import clsx from "clsx";
import { forwardRef } from "react";

const INPUT_BASE =
  "input input-bordered w-full bg-base-100 disabled:bg-base-200 disabled:cursor-not-allowed text-xs h-8 focus:outline-offset-0 focus:border-primary/50";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ placeholder, className, type = "text", ...props }, ref) => {
    return <input ref={ref} type={type} placeholder={placeholder} className={clsx(INPUT_BASE, className)} {...props} />;
  },
);
