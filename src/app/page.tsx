import { RadarDashboard } from "@/components/radar-dashboard";
import { getLatestRadarSnapshot } from "@/lib/db";
import { getRadarSnapshot } from "@/lib/demo-data";
import { getIntegrationStatus } from "@/lib/env";

export default async function Home() {
  const snapshot = (await getLatestRadarSnapshot()) ?? getRadarSnapshot();

  return (
    <RadarDashboard
      initialSnapshot={snapshot}
      integrationStatus={getIntegrationStatus()}
    />
  );
}
