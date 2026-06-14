import { RadarShell } from "@/components/radar/radar-shell";
import { getLatestRadarSnapshot } from "@/lib/db";
import { getRadarSnapshot } from "@/lib/demo-data";
import { getIntegrationStatus } from "@/lib/env";

export default async function NegotiationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const snapshot = (await getLatestRadarSnapshot()) ?? getRadarSnapshot();
  return (
    <RadarShell
      initialSnapshot={snapshot}
      integrationStatus={getIntegrationStatus()}
      initialView="negotiations"
      initialNegotiationId={id}
    />
  );
}
