// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Message } from "./Message";

afterEach(cleanup);

const cite = { path: "lib/response.js", startLine: 157, endLine: 166 };

describe("Message", () => {
  it("renders markdown with verified citations as inline chips that open the file", async () => {
    const onOpen = vi.fn();
    const { container } = render(
      <Message
        text={"It calls `this.json(chunk)` [lib/response.js:157-166].\n\n- one\n- two"}
        citations={[cite]}
        onOpen={onOpen}
      />,
    );
    expect(container.querySelector("p code")?.textContent).toBe("this.json(chunk)");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    const chip = screen.getByRole("button", { name: "lib/response.js:157-166" });
    expect(chip.closest("p")).toBeTruthy();
    await userEvent.setup().click(chip);
    expect(onOpen).toHaveBeenCalledWith(cite);
  });

  it("leaves unverified citations and citations inside code as text", () => {
    render(
      <Message
        text={"See [lib/made-up.js:1-2] and `[lib/response.js:157-166]`."}
        citations={[cite]}
        onOpen={() => {}}
      />,
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText(/lib\/made-up\.js:1-2/)).toBeTruthy();
  });

  it("never renders raw HTML or loads images", () => {
    const { container } = render(
      <Message
        text={'<img src="http://x/a.png" onerror="alert(1)"> hi ![logo](http://x/b.png)'}
        citations={[]}
        onOpen={() => {}}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("logo");
  });

  it("renders fenced code as a highlighted block", () => {
    const { container } = render(
      <Message text={"```js\nconst a = 1;\n```"} citations={[]} onOpen={() => {}} />,
    );
    expect(container.querySelector(".codeblock pre")?.textContent).toBe("const a = 1;");
  });
});
