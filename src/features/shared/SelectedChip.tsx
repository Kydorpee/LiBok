import { X } from "lucide-react";
import type { ReactNode } from "react";

export function SelectedChip({
  label,
  value,
  badge,
  onClear,
}: {
  label: string;
  value: string;
  badge?: ReactNode;
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label text-text-primary">{label}</span>
      <div className="flex items-center gap-2 rounded-sm border border-border-default bg-bg-subtle px-3 py-2">
        <span className="text-body-strong">{value}</span>
        {badge}
        {onClear ? (
          <button
            type="button"
            aria-label={`Trocar ${label.toLowerCase()}`}
            onClick={onClear}
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-sm text-text-muted hover:bg-bg-hover"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
