import type { DialogueNodeData } from "../ZoneTypes";
import type { DialogueDefMap } from "./DialogueDef";

const fallback: DialogueNodeData[] = [
  {
    speaker: "Narrator",
    text: "There is nothing to say yet.",
    pitch: 1,
  },
];

const dialogueMaps = [
  { "unknown_npc.default": fallback },
  ...getSortedContentModules(
    import.meta.glob<unknown>("../../content/dialogues/*.json", {
      eager: true,
      import: "default",
    }),
  ),
];

const registry = buildRegistry(dialogueMaps);

/**
 * Returns true when a dialogue id is available in the dialogue registry.
 */
export function hasDialogue(dialogueId: string): boolean {
  return Object.prototype.hasOwnProperty.call(registry, dialogueId);
}

/**
 * Returns a detached dialogue sequence for an id.
 *
 * Unknown ids resolve to a fallback line for runtime resilience. Content
 * validation should still reject unknown dialogue ids.
 */
export function getDialogue(dialogueId: string): DialogueNodeData[] {
  const dialogue = registry[dialogueId] ?? fallback;
  return dialogue.map((node) => ({ ...node }));
}

function buildRegistry(dialogueMaps: unknown[]): DialogueDefMap {
  const nextRegistry: DialogueDefMap = {};

  for (const dialogueMap of dialogueMaps) {
    if (!isRecord(dialogueMap)) {
      throw new Error("Dialogue registry files must contain objects.");
    }

    for (const [dialogueId, nodes] of Object.entries(dialogueMap)) {
      if (!dialogueId.trim()) {
        throw new Error("Dialogue definitions must have non-empty ids.");
      }

      if (nextRegistry[dialogueId]) {
        throw new Error(`Duplicate dialogue definition "${dialogueId}".`);
      }

      assertDialogueNodes(dialogueId, nodes);
      nextRegistry[dialogueId] = nodes.map((node) => ({ ...node }));
    }
  }

  return nextRegistry;
}

function getSortedContentModules(modules: Record<string, unknown>): unknown[] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, module]) => module);
}

function assertDialogueNodes(
  dialogueId: string,
  value: unknown,
): asserts value is DialogueNodeData[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Dialogue "${dialogueId}" must contain nodes.`);
  }

  for (let i = 0; i < value.length; i++) {
    const node = value[i];

    if (!isRecord(node)) {
      throw new Error(`Dialogue "${dialogueId}" node ${i} must be an object.`);
    }

    if (typeof node.speaker !== "string" || !node.speaker.trim()) {
      throw new Error(`Dialogue "${dialogueId}" node ${i} has invalid speaker.`);
    }

    if (typeof node.text !== "string" || !node.text.trim()) {
      throw new Error(`Dialogue "${dialogueId}" node ${i} has invalid text.`);
    }

    if (
      typeof node.pitch !== "number" ||
      !Number.isFinite(node.pitch) ||
      node.pitch < 0.1
    ) {
      throw new Error(`Dialogue "${dialogueId}" node ${i} has invalid pitch.`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
