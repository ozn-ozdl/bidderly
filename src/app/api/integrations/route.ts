import { getIntegrationStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getIntegrationStatus());
}
