import { cloneElement, forwardRef, isValidElement } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-9 w-full rounded-md border border-line bg-surface px-3 text-base text-fg placeholder:text-faint",
      "transition-colors hover:border-line-strong focus:border-accent focus:outline-none focus-visible:outline-none",
      "aria-[invalid=true]:border-danger disabled:opacity-60",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {isValidElement<{
        "aria-describedby"?: string;
        "aria-invalid"?: boolean;
      }>(children)
        ? cloneElement(children, {
            "aria-describedby": error
              ? `${htmlFor}-error`
              : hint
                ? `${htmlFor}-hint`
                : undefined,
            "aria-invalid": error ? true : undefined,
          })
        : children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
