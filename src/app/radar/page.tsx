import { getLatestRadarSnapshot } from "@/lib/db";
import { getRadarSnapshot } from "@/lib/demo-data";
import { getIntegrationStatus } from "@/lib/env";
import { RadarShell } from "@/components/radar/radar-shell";

export default async function RadarPage() {
  const snapshot = (await getLatestRadarSnapshot()) ?? getRadarSnapshot();
  const integrationStatus = getIntegrationStatus();

  return <RadarShell initialSnapshot={snapshot} integrationStatus={integrationStatus} />;
}
