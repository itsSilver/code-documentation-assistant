/** Runs once when the server starts. Indexes the sample repo in the background if it is missing. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { seedOnStart } = await import("./server/seed/startup");
  void seedOnStart();
}
