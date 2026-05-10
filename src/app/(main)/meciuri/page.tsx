import { MeciuriFixturesView } from "@/components/meciuri/meciuri-fixtures-view";
import { fetchTodayTrackedFixtures } from "@/lib/football-api/fetch-today";

/** Aliniat la cron-ul Vercel (3 ore); cron poate invalide și mai devreme. */
export const revalidate = 10_800;

export default async function MeciuriPage() {
  const data = await fetchTodayTrackedFixtures();

  return (
    <main className="relative mx-auto w-full pb-shell-inner flex-1 px-6 py-12 md:px-10 md:py-16">
      <MeciuriFixturesView
        fixtures={data.fixtures}
        date={data.date}
        ok={data.ok}
        error={data.ok ? null : data.error}
      />
    </main>
  );
}
