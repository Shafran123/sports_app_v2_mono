import { LoginForm } from "@/features/auth/login-form";
import { SiteLoginPage } from "@/features/site/site-login-page";
import { getSiteContext } from "@/lib/site-context";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Host-aware (ADR-0029/0030): a live Dedicated Site hostname renders the
  // site's own sign-up/sign-in form (Site Customer auth) in site chrome; the
  // marketplace host keeps the Player login form.
  const site = await getSiteContext();
  if (site) return <SiteLoginPage config={site} />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <LoginForm />
    </main>
  );
}