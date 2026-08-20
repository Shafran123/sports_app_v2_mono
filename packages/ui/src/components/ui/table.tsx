import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@spots/utils";

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-3xl border border-border bg-surface", className)}>
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <thead>
      <tr className={cn("border-b border-border bg-surface-2/60", className)}>{children}</tr>
    </thead>
  );
}

export function Th({ className, children, sort, sortKey, onSort }: { className?: string; children: React.ReactNode; sort?: { key: string; dir: "asc" | "desc" }; sortKey?: string; onSort?: (key: string) => void }) {
  const sortable = !!sortKey && !!onSort;
  const active = sort && sortKey && sort.key === sortKey;
  return (
    <th
      className={cn("whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-3", className)}
    >
      {sortable ? (
        <button
          onClick={() => onSort!(sortKey!)}
          className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink"
        >
          {children}
          {active ? (
            sort!.dir === "asc" ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-50" />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function Td({ className, children }: { className?: string; children: React.ReactNode }) {
  return <td className={cn("px-4 py-3 text-ink-2", className)}>{children}</td>;
}

export function TableRow({ className, children, onClick }: { className?: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={cn("border-b border-border last:border-b-0 hover:bg-surface-2/40", onClick && "cursor-pointer", className)}
    >
      {children}
    </tr>
  );
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}