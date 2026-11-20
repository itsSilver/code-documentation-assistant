import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

/**
 * Module boundaries. Imports across modules use the `@/` alias, which is what these patterns match.
 */
const SERVER = "@/server/**";
const APP = "@/app/**";
const UI = "@/components/**";
const feature = (name) => `@/features/${name}/**`;
const LEAF_FEATURES = ["chat", "ingest", "repo"];

const boundary = (files, group, message) => ({
  files,
  rules: { "no-restricted-imports": ["error", { patterns: [{ group, message }] }] },
});

const boundaries = [
  boundary(
    ["src/server/**"],
    [APP, UI, "@/features/**"],
    "Server code must not depend on the UI or on routing.",
  ),
  boundary(
    ["src/shared/**"],
    [APP, UI, SERVER, "@/features/**"],
    "src/shared is the bottom layer: it imports nothing else from the app.",
  ),
  boundary(
    ["src/components/**"],
    [APP, SERVER, "@/features/**"],
    "UI primitives know nothing about features or the server.",
  ),
  boundary(
    ["src/features/workspace/**"],
    [APP, SERVER],
    "Browser code must not import server code. Wire types live in src/shared/contracts.ts.",
  ),
  ...LEAF_FEATURES.map((name) =>
    boundary(
      [`src/features/${name}/**`],
      [APP, SERVER, feature("workspace"), ...LEAF_FEATURES.filter((f) => f !== name).map(feature)],
      "A feature imports only src/shared and src/components/ui. The workspace composes features.",
    ),
  ),
];

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "data/**",
      "pnpm-lock.yaml",
      "evals/sample/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  ...boundaries,
  prettier,
];

export default config;
