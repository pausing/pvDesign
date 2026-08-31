import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost" | "danger";
}) {
  const styles = {
    default: "bg-raised border border-line text-text hover:border-muted",
    primary: "bg-accent text-ink font-medium hover:opacity-90 border border-accent",
    ghost: "bg-transparent text-muted hover:text-text hover:bg-raised",
    danger: "bg-transparent text-danger border border-danger/40 hover:bg-danger/10",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] disabled:opacity-40 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-[12px] text-muted ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function NumInput({
  value,
  onChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === "" ? null : Number(raw));
      }}
      className="w-full"
      {...props}
    />
  );
}

export function TextInput({
  value,
  onChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full"
      {...props}
    />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-line bg-panel ${className}`}>{children}</div>
  );
}

export function StatusDot({ status }: { status: string }) {
  const color =
    status === "saving"
      ? "bg-amber"
      : status === "error"
        ? "bg-danger"
        : status === "saved" || status === "ready"
          ? "bg-accent"
          : "bg-muted";
  const label =
    status === "saving"
      ? "Saving"
      : status === "error"
        ? "Error"
        : status === "saved"
          ? "Saved"
          : status === "loading"
            ? "Loading"
            : "Ready";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
