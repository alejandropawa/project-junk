import { AccountBillingPanel } from "@/components/auth/account-drawer-panels";

export default function ContAbonamentPage() {
  return (
    <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12 md:py-16">
      <h1 className="pb-text-section">Abonament</h1>
      <div className="mt-3">
        <AccountBillingPanel />
      </div>
    </main>
  );
}
