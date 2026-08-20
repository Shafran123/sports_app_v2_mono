import { RequireAdmin } from "@/context/auth";
import { ApprovalsQueue } from "@/features/admin-console/approvals-queue";

export default function Page() {
  return (
    <RequireAdmin>
      <ApprovalsQueue />
    </RequireAdmin>
  );
}