import { createLlm } from "@/server/llm/providers";
import { LlmConfigError } from "@/server/llm/types";
import type { LlmStatus } from "@/shared/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  try {
    const llm = createLlm();
    const status: LlmStatus = { ready: true, model: llm.model ?? "", local: !!llm.local };
    return Response.json({ llm: status });
  } catch (e) {
    if (e instanceof LlmConfigError) {
      const status: LlmStatus = { ready: false, help: e.message };
      return Response.json({ llm: status });
    }
    throw e;
  }
}
