import { getSettings } from "@/lib/queries";
import { resolvePeople } from "@/lib/chores";
import { buildGratitudeFeed } from "@/lib/gratitude";
import { GratitudeList } from "@/components/gratitude/gratitude-list";

export const dynamic = "force-dynamic";

export default async function GratitudePage() {
  const feed = await buildGratitudeFeed();
  return (
    <GratitudeList
      people={resolvePeople(await getSettings())}
      groups={feed.groups}
      total={feed.total}
      streak={feed.streak}
      memory={feed.memory}
      recap={feed.recap}
    />
  );
}
