// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Workspace } from "./Workspace";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const ndjson = (...events: object[]) =>
  new Response(events.map((e) => JSON.stringify(e)).join("\n") + "\n");

const CODE = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n");
const citation = { path: "src/a.ts", startLine: 4, endLine: 6 };

const demo = { id: 1, name: "acme/demo", source: "x", fileCount: 1 };

let routes: Record<string, () => Response>;
beforeEach(() => {
  routes = {
    "/api/repos": () => json({ repos: [{ ...demo, status: "ready" }] }),
    "/api/status": () => json({ llm: { ready: true, model: "m", local: true } }),
    "/api/repos/1/files": () =>
      json({ files: [{ path: "src/a.ts", language: "typescript", lineCount: 12 }] }),
    "/api/repos/1/file?path=src%2Fa.ts": () => json({ path: "src/a.ts", content: CODE }),
    "/api/chat": () =>
      ndjson(
        { type: "sources", chunks: [] },
        { type: "delta", text: "It lives in [src/a.ts:4-6]." },
        { type: "done", citations: [citation], answered: true },
      ),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const route = routes[url];
      if (!route) throw new Error(`unmocked ${url}`);
      return route();
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Workspace", () => {
  it("opens the cited file with exactly the cited lines highlighted", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(await screen.findByRole("button", { name: /what does this project do/i }));
    await user.click(await screen.findByRole("button", { name: "src/a.ts:4-6" }));

    const viewer = await screen.findByRole("region", { name: "Code: src/a.ts" });
    await waitFor(() => expect(viewer.querySelectorAll("[data-line]")).toHaveLength(12));
    const lit = [...viewer.querySelectorAll('[data-highlighted="true"]')].map((l) =>
      l.getAttribute("data-line"),
    );
    expect(lit).toEqual(["4", "5", "6"]);
    expect(within(viewer).getByText("lines 4–6")).toBeTruthy();
  });

  it("shows an empty state when nothing is indexed", async () => {
    routes["/api/repos"] = () => json({ repos: [] });
    render(<Workspace />);
    expect(await screen.findByText("No repository yet")).toBeTruthy();
  });

  it("shows an error with retry when repos cannot load", async () => {
    routes["/api/repos"] = () => json({ error: "db down" }, 500);
    render(<Workspace />);
    expect((await screen.findByRole("alert")).textContent).toContain("db down");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("shows a chat error when the stream fails", async () => {
    routes["/api/chat"] = () => json({ error: "No LLM configured" }, 503);
    const user = userEvent.setup();
    render(<Workspace />);
    await user.click(await screen.findByRole("button", { name: /what does this project do/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("No LLM configured");
  });

  it("retries a failed question and shows the answer", async () => {
    let calls = 0;
    const ok = routes["/api/chat"];
    routes["/api/chat"] = () => (++calls === 1 ? json({ error: "busy" }, 503) : ok());
    const user = userEvent.setup();
    render(<Workspace />);
    await user.click(await screen.findByRole("button", { name: /what does this project do/i }));
    await user.click(await screen.findByRole("button", { name: /retry/i }));
    expect(await screen.findByRole("button", { name: "src/a.ts:4-6" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByText(/what does this project do/i)).toHaveLength(1);
  });

  it("treats an empty answer as an error the user can retry", async () => {
    routes["/api/chat"] = () =>
      ndjson({ type: "sources", chunks: [] }, { type: "done", citations: [] });
    const user = userEvent.setup();
    render(<Workspace />);
    await user.click(await screen.findByRole("button", { name: /what does this project do/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("without writing an answer");
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("warns before the first question when no model is configured", async () => {
    routes["/api/status"] = () => json({ llm: { ready: false, help: "Set OPENROUTER_API_KEY" } });
    render(<Workspace />);
    expect((await screen.findByText(/OPENROUTER_API_KEY/)).tagName).toBe("CODE");
  });

  it("reloads the file list when re-indexing the repo that is open", async () => {
    routes["/api/ingest"] = () =>
      ndjson(
        { stage: "indexing", message: "Embedding chunks 1-1 of 1" },
        { stage: "done", message: "Indexed 1 files", repoId: 1 },
      );
    const user = userEvent.setup();
    render(<Workspace />);
    await user.click(await screen.findByRole("button", { name: /add repository/i }));
    await user.type(await screen.findByLabelText("GitHub URL"), "https://github.com/acme/demo");
    await user.click(screen.getByRole("button", { name: "Index" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByRole("button", { name: "a.ts" })).toBeTruthy();
  });

  it("lets the user chat while embedding and says how much is indexed", async () => {
    routes["/api/repos"] = () =>
      json({ repos: [{ ...demo, status: "indexing", done: 290, total: 869 }] });
    render(<Workspace />);
    expect((await screen.findAllByText(/Embedding 33%/)).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Answers use the 290 of 869 chunks indexed so far/).textContent,
    ).toContain("Still embedding (33%)");
    expect(screen.getByRole("button", { name: /what does this project do/i })).toBeTruthy();
    expect((screen.getByLabelText("Your question") as HTMLTextAreaElement).disabled).toBe(false);
  });

  it("offers Re-index for a repo whose embedding stopped, and starts it", async () => {
    let calls = 0;
    routes["/api/repos"] = () =>
      json({ repos: [{ ...demo, ...(calls ? { status: "queued" } : { status: "incomplete" }) }] });
    routes["/api/repos/1/reindex"] = () => {
      calls++;
      return json({ status: "queued" }, 202);
    };
    const user = userEvent.setup();
    render(<Workspace />);
    await user.click(await screen.findByRole("button", { name: /re-index/i }));
    expect(calls).toBe(1);
    expect((await screen.findAllByText(/Queued/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /re-index/i })).toBeNull();
  });

  it("shows an ingest error from the progress stream", async () => {
    routes["/api/ingest"] = () =>
      ndjson(
        { stage: "reading", message: "Downloading" },
        { stage: "error", message: "Repo too large" },
      );
    const user = userEvent.setup();
    render(<Workspace />);
    await user.click(await screen.findByRole("button", { name: /add repository/i }));
    await user.type(await screen.findByLabelText("GitHub URL"), "https://github.com/a/b");
    await user.click(screen.getByRole("button", { name: "Index" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Repo too large");
  });
});
