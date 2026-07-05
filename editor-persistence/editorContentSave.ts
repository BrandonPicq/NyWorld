import { mkdir, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Plugin } from "vite";

const SAVE_ENDPOINT = "/__editor/save";
const CONTENT_ROOT = "src/content";
const MAX_BODY_BYTES = 2 * 1024 * 1024;

/**
 * Custom header the editor client must send with every save request.
 *
 * A cross-origin page cannot attach a custom header without triggering a CORS
 * preflight, and the save endpoint never approves preflights, so this blocks
 * drive-by POSTs from other sites open in the same browser.
 */
export const EDITOR_REQUEST_HEADER = "x-nywarudo-editor";
export const EDITOR_REQUEST_HEADER_VALUE = "save";

export type EditorRequestHeadersResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Validates that a save request comes from the editor UI itself.
 *
 * The custom marker header is the primary defense; the Origin/Host comparison
 * is belt-and-braces for clients that send an Origin header.
 */
export function validateEditorRequestHeaders(headers: {
  origin?: string;
  host?: string;
  editorMarker?: string;
}): EditorRequestHeadersResult {
  if (headers.editorMarker !== EDITOR_REQUEST_HEADER_VALUE) {
    return { ok: false, reason: "Missing editor request header." };
  }

  if (headers.origin !== undefined) {
    let originHost: string;
    try {
      originHost = new URL(headers.origin).host;
    } catch {
      return { ok: false, reason: "Invalid request origin." };
    }

    if (!headers.host || originHost !== headers.host) {
      return {
        ok: false,
        reason: "Cross-origin editor saves are not allowed.",
      };
    }
  }

  return { ok: true };
}

export type EditorContentPathResult =
  | {
      ok: true;
      absolutePath: string;
      relativePath: string;
    }
  | {
      ok: false;
      reason: string;
    };

export function resolveEditorContentPath(
  projectRoot: string,
  requestedPath: string,
): EditorContentPathResult {
  if (!requestedPath.trim()) {
    return { ok: false, reason: "Missing content path." };
  }

  if (requestedPath.includes("\0")) {
    return { ok: false, reason: "Content path contains an invalid character." };
  }

  if (path.isAbsolute(requestedPath)) {
    return { ok: false, reason: "Content path must be project-relative." };
  }

  const relativePath = requestedPath.replace(/\\/g, "/");
  const parts = relativePath.split("/");

  if (
    parts.some((part) => part === "" || part === "." || part === "..")
  ) {
    return { ok: false, reason: "Content path must not traverse directories." };
  }

  if (!relativePath.startsWith(`${CONTENT_ROOT}/`)) {
    return {
      ok: false,
      reason: `Content path must be under ${CONTENT_ROOT}.`,
    };
  }

  if (!relativePath.endsWith(".json")) {
    return { ok: false, reason: "Content path must target a JSON file." };
  }

  const root = path.resolve(projectRoot);
  const contentRoot = path.resolve(root, CONTENT_ROOT);
  const absolutePath = path.resolve(root, relativePath);
  const contentRelativePath = path.relative(contentRoot, absolutePath);

  if (
    contentRelativePath === "" ||
    contentRelativePath.startsWith("..") ||
    path.isAbsolute(contentRelativePath)
  ) {
    return {
      ok: false,
      reason: `Content path must stay inside ${CONTENT_ROOT}.`,
    };
  }

  return { ok: true, absolutePath, relativePath };
}

export function editorContentSavePlugin(): Plugin {
  let projectRoot = process.cwd();

  return {
    name: "nywarudo-editor-content-save",
    apply: "serve",
    configResolved(config) {
      projectRoot = config.root;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = req.url?.split("?")[0];
        if (requestUrl !== SAVE_ENDPOINT) {
          next();
          return;
        }

        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed." });
          return;
        }

        const headerCheck = validateEditorRequestHeaders({
          origin: readSingleHeader(req.headers.origin),
          host: readSingleHeader(req.headers.host),
          editorMarker: readSingleHeader(req.headers[EDITOR_REQUEST_HEADER]),
        });
        if (!headerCheck.ok) {
          sendJson(res, 403, { error: headerCheck.reason });
          return;
        }

        try {
          const payload = parseSaveRequest(await readRequestBody(req));
          if (!payload.ok) {
            sendJson(res, 400, { error: payload.reason });
            return;
          }

          const resolvedPath = resolveEditorContentPath(
            projectRoot,
            payload.path,
          );
          if (!resolvedPath.ok) {
            sendJson(res, 403, { error: resolvedPath.reason });
            return;
          }

          try {
            JSON.parse(payload.content);
          } catch {
            sendJson(res, 400, { error: "Content must be valid JSON text." });
            return;
          }

          await mkdir(path.dirname(resolvedPath.absolutePath), {
            recursive: true,
          });
          await writeFile(
            resolvedPath.absolutePath,
            ensureTrailingNewline(payload.content),
            "utf8",
          );

          sendJson(res, 200, { ok: true, path: resolvedPath.relativePath });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unable to save content.";
          sendJson(res, 500, { error: message });
        }
      });
    },
  };
}

function parseSaveRequest(
  rawBody: string,
):
  | { ok: true; path: string; content: string }
  | { ok: false; reason: string } {
  let value: unknown;

  try {
    value = JSON.parse(rawBody);
  } catch {
    return { ok: false, reason: "Request body must be JSON." };
  }

  if (!isRecord(value)) {
    return { ok: false, reason: "Request body must be an object." };
  }

  if (typeof value.path !== "string") {
    return { ok: false, reason: "Request body must include a string path." };
  }

  if (typeof value.content !== "string") {
    return { ok: false, reason: "Request body must include string content." };
  }

  return { ok: true, path: value.path, content: value.content };
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new Error("Request body is too large.");
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function readSingleHeader(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
