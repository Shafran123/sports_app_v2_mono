import { LeadsPage } from "@/features/leads/leads-page";
import { RequireAdmin } from "@/context/auth";

export default function LeadsRoute() {
  return (
    <RequireAdmin>
      <LeadsPage />
    </RequireAdmin>
  );
}