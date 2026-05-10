import Link from "next/link";
import {
  AccountSettingsPanelForPage,
} from "@/components/auth/account-drawer-panels";
import { createClient } from "@/lib/supabase/server";

export default async function ContSetariPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12 md:py-16">
      <h1 className="pb-text-section">Setări cont</h1>
      {!user ? (
        <p className="mt-3 pb-text-body text-muted-foreground">
          Autentifică-te pentru a vedea setările.{" "}
          <Link
            className="font-medium text-primary underline-offset-2 hover:underline"
            href="/"
          >
            Înapoi acasă
          </Link>
        </p>
      ) : (
        <div className="mt-6">
          <AccountSettingsPanelForPage user={user} />
        </div>
      )}
    </main>
  );
}
