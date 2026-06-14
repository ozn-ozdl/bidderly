// Public surface of the Pioneer integration.
//
// The cascade, the API routes, and the UI panel import from here only.

export * from "./schemas";
export * as client from "./client";
export {
  isPioneerConfigured,
  isPioneerDryRun,
  PioneerError,
  PIONEER_API_KEY,
  PIONEER_BASE_URL,
  pioneerFetch,
  type PioneerFetchInit,
  type PioneerFetchResult,
} from "./client";
export * as datasets from "./datasets";
export {
  startGenerationJob,
  pollGenerationJob,
  listDatasets,
  getDataset,
  makeGenerationRequests,
  PIONEER_DOMAIN_DESCRIPTION,
  PIONEER_DECODER_PROMPT,
  type GenerationRequest,
  type GenerateJobStatus,
} from "./datasets";
export * as training from "./training";
export {
  startTrainingJob,
  pollTrainingJob,
  listTrainingJobs,
  getTrainingLogs,
  listCheckpoints,
  stopTrainingJob,
  downloadTrainingJob,
  type TrainingJobStatus,
  type TrainingRequest,
  type TrainingJobKind,
} from "./training";
export * as evaluations from "./evaluations";
export {
  runEvaluation,
  getEvaluation,
  listEvaluations,
  type EvaluationEnvelope,
  type EvaluationResult,
} from "./evaluations";
export * as inference from "./inference";
export {
  inferExtractionAndClues,
  inferScoring,
  snapshotScoringRows,
  type ExtractionAndClues,
  type ExtractedEntity,
} from "./inference";
export * as builders from "./synthetic-builders";
export {
  buildNerRow,
  buildNerRowsFromExamples,
  buildNerRowsFromExtractions,
  buildClueRow,
  buildClueRowsFromExamples,
  buildClueRowsFromExtractions,
  buildScoringRow,
  buildScoringRows,
  buildScoringPrompt,
} from "./synthetic-builders";
export * as dryRunStore from "./dry-run-store";
export {
  dryRunGetDataset,
  dryRunListDatasets,
  dryRunGetTrainingJob,
  dryRunListTrainingJobs,
  dryRunGetEvaluation,
  dryRunListEvaluations,
  dryRunReset,
} from "./dry-run-store";
