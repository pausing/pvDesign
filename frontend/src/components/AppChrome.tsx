import { Outlet } from "react-router-dom";
import { useMe } from "../lib/useMe";

export function UserGreeting() {
  const me = useMe();
  if (!me?.email) return null;
  return (
    <p className="truncate text-[13px] text-muted">
      Hello, <span className="text-text">{me.email}</span>
    </p>
  );
}

export function AppChrome() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-line bg-panel px-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-accent">PV Design</div>
        <UserGreeting />
      </header>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
