import { OwnersPage } from "@/features/owners/owners-page";
import { RequireAdmin } from "@/context/auth";

export default function OwnersRoute() {
  return (
    <RequireAdmin>
      <OwnersPage />
    </RequireAdmin>
  );
}