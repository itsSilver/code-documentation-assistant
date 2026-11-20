/**
 * Estimated USD cost of one model call. Free models (an OpenRouter `:free` id) and local
 * models are 0. A paid model is `null` (unknown), never a guess: see OpenRouter's dashboard.
 */
export function estimateCost(
  model: string | undefined,
  _inputTokens: number,
  _outputTokens: number,
  local = false,
): number | null {
  return local || model?.endsWith(":free") ? 0 : null;
}
