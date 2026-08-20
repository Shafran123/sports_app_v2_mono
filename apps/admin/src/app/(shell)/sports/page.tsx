import { RequireAdmin } from "@/context/auth";
import { SportsTable } from "@/features/admin-console/sports-table";

export default function Page() {
  return (
    <RequireAdmin>
      <SportsTable />
    </RequireAdmin>
  );
}