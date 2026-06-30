import type { DialogueNode } from "./dialogueTypes";

type DialogueBoxProps = {
  isTyping: boolean;
  node: DialogueNode;
  onProgress: () => void;
  visibleText: string;
};

export function DialogueBox({
  isTyping,
  node,
  onProgress,
  visibleText,
}: DialogueBoxProps) {
  return (
    <div className="dialogue-box" onClick={onProgress}>
      <div className="dialogue-box__header">
        <span className="dialogue-box__speaker">{node.speaker}</span>
      </div>
      <div className="dialogue-box__body">
        <p className="dialogue-box__text">{visibleText}</p>
      </div>
      <div className="dialogue-box__footer">
        <span className="dialogue-box__prompt">
          {isTyping ? "..." : "Press Enter or Click to Continue"}
        </span>
      </div>
    </div>
  );
}
