export const ITEM_CATALOG_CONTENT_PATH = "src/content/items/items.json";

export type EditorSaveResult =
  | {
      ok: true;
      path: string;
    }
  | {
      ok: false;
      error: string;
    };

export async function saveEditorContent(
  path: string,
  content: string,
): Promise<EditorSaveResult> {
  try {
    const response = await fetch("/__editor/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-NyWarudo-Editor": "save",
      },
      body: JSON.stringify({ path, content }),
    });
    const payload = await readJsonPayload(response);

    if (!response.ok) {
      return {
        ok: false,
        error: readErrorMessage(payload) ?? `Save failed (${response.status}).`,
      };
    }

    return {
      ok: true,
      path: readSavedPath(payload) ?? path,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Save failed.",
    };
  }
}

async function readJsonPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function readErrorMessage(payload: unknown): string | undefined {
  return isRecord(payload) && typeof payload.error === "string"
    ? payload.error
    : undefined;
}

function readSavedPath(payload: unknown): string | undefined {
  return isRecord(payload) && typeof payload.path === "string"
    ? payload.path
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
