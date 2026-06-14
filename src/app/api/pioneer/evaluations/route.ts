// POST /api/pioneer/evaluations
//
// Submits an evaluation against a labeled dataset for a given base
// model (typically a Pioneer training-job id).
//
// GET /api/pioneer/evaluations
//
// Returns the dry-run store list. The Pioneer live API does not
// document a list endpoint, so live mode returns an empty array.

import { z } from "zod";

import { getEvaluation, isPioneerDryRun, listEvaluations, runEvaluation } from "@/lib/pioneer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    baseModel: z.string().min(1),
    datasetName: z.string().min(1),
  });

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema> | null = null;
  try {
    const text = await request.text();
    if (text) body = bodySchema.parse(JSON.parse(text));
  } catch {
    body = null;
  }
  if (!body) {
    return Response.json({ error: "missing_body" }, { status: 400 });
  }
  const result = await runEvaluation({ baseModel: body.baseModel, datasetName: body.datasetName });
  return Response.json({ pioneerDryRun: isPioneerDryRun(), evaluation: result });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (id) {
    const ev = await getEvaluation(id);
    return Response.json({ pioneerDryRun: isPioneerDryRun(), evaluation: ev });
  }
  const all = await listEvaluations();
  return Response.json({ pioneerDryRun: isPioneerDryRun(), evaluations: all });
}
