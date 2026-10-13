import type { CopyStatus, LoanStatus } from "../../lib/types";
import type { LoanStatus as BadgeStatus } from "../../components/ui";

/** O contrato usa `loaned`/`active`; o StatusBadge usa `borrowed`. */
export function toBadgeStatus(s: LoanStatus | CopyStatus["status"]): BadgeStatus {
  switch (s) {
    case "active":
    case "loaned":
      return "borrowed";
    default:
      return s;
  }
}
