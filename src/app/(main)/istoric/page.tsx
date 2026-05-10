import { IstoricView } from "@/components/istoric/istoric-view";
import { getBucharestDateString } from "@/lib/football-api/bucharest-calendar";

export const dynamic = "force-dynamic";

export default async function IstoricPage() {
  const todayRo = getBucharestDateString();

  return (
    <main className="relative mx-auto w-full pb-shell-inner flex-1 px-6 py-12 md:px-10 md:py-16">
      <div className="mb-8">
        <h1 className="pb-text-section">Istoric predicții</h1>
      </div>
      <IstoricView todayRo={todayRo} />
    </main>
  );
}
