import { getDb } from "./db";
import { Repository } from "./db/repository";
import { localEmbedder } from "./embed/embedder";

/**
 * The one place that wires real infrastructure together. Route handlers, the startup hook and the
 * scripts take their dependencies from here; everything below it receives them as arguments, which
 * is what lets the tests pass in an in-memory database and a fake embedder.
 */
export const getRepository = (): Repository => new Repository(getDb());

export const embedder = localEmbedder;
