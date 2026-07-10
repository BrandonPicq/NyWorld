import { useState } from "react";
import {
  type ContentCatalogSnapshot,
  type EventAction,
  type EventCondition,
  type EventDef,
  type EventTrigger,
} from "../../../engine";
import type { GridCell } from "../../../rendering/canvasCellMapping";
import { IdentifierLabel } from "../../components/IdentifierLabel";
import { ScrollRegion } from "../../components/ScrollRegion";
import { EditorButton } from "../components/EditorButton";
import { EditorPanel } from "../components/EditorPanel";
import { DiagnosticList, type EditorContentNavigationTarget } from "../DiagnosticList";
import { EditorGroupedList } from "../EditorGroupedList";
import { ReferenceList } from "../ReferenceList";
import { MapCoordinatePicker } from "../MapCoordinatePicker";
import {
  addEventAction,
  addEventCondition,
  EVENT_ACTION_TYPES,
  EVENT_CONDITION_TYPES,
  EVENT_TRIGGER_TYPES,
  type EventGroupingMode,
  groupEventEntries,
  removeEventAction,
  removeEventCondition,
  setEventTrigger,
} from "./eventEditorModel";
import type { EventDraftController } from "./useEventDraft";

export function EventTab({ draft, onNavigate, snapshot }: { draft: EventDraftController; onNavigate: (target: EditorContentNavigationTarget) => void; snapshot: ContentCatalogSnapshot }) {
  const [listFilter, setListFilter] = useState("");
  const [groupingMode, setGroupingMode] = useState<EventGroupingMode>("type");
  const [areaPicker, setAreaPicker] = useState<string | null>(null);
  const [areaFirstCell, setAreaFirstCell] = useState<GridCell | null>(null);
  const eventGroups = groupEventEntries(draft.events, groupingMode).map((group) => ({
    key: group.key,
    label: group.label,
    entries: group.entries.map((event) => ({
      key: event.eventId,
      id: event.eventId,
      name: event.eventId,
      label: <IdentifierLabel value={event.eventId} />,
      meta: `priority ${event.priority}`,
      isUnsaved: draft.events.find((entry) => entry.eventId === event.eventId)
        ?.hasUnsavedChanges,
    })),
  }));
  return (
    <>
      <section className="editor-summary" aria-label="Event summary">
        <span>{draft.events.length} events</span><span>{draft.errorCount} errors</span><span>{draft.warningCount} warnings</span><span>{draft.hasUnsavedChanges ? "unsaved" : "saved"}</span>
      </section>
      {areaPicker ? <MapCoordinatePicker snapshot={snapshot} title={areaFirstCell ? "Pick area opposite corner" : "Pick area first corner"} zoneId={areaPicker} onPick={(cell) => { const selected = draft.selectedEvent; if (!selected || (selected.trigger.type !== "step_on_area" && selected.trigger.type !== "interact_on_area")) return; if (!areaFirstCell) { setAreaFirstCell(cell); draft.updateSelectedEvent((current) => current.trigger.type === "step_on_area" || current.trigger.type === "interact_on_area" ? { ...current, trigger: { ...current.trigger, area: { ...current.trigger.area, x: cell.x, y: cell.y, width: 1, height: 1 } } } : current); return; } const x = Math.min(areaFirstCell.x, cell.x); const y = Math.min(areaFirstCell.y, cell.y); draft.updateSelectedEvent((current) => current.trigger.type === "step_on_area" || current.trigger.type === "interact_on_area" ? { ...current, trigger: { ...current.trigger, area: { x, y, width: Math.abs(cell.x - areaFirstCell.x) + 1, height: Math.abs(cell.y - areaFirstCell.y) + 1 } } } : current); setAreaFirstCell(null); }} onClose={() => setAreaPicker(null)} /> : null}
      <div className="workbench">
        <ScrollRegion className="workbench__rail"><EditorPanel className="editor-panel">
          <h2 className="editor-panel__title">Events</h2>
          <div className="editor-event-grouping">
            <span className="editor-event-grouping__label">Group by</span>
            <div
              aria-label="Event grouping"
              className="editor-mode-selector"
              role="group"
            >
              {([
                ["type", "Type"],
                ["zone", "Zone"],
              ] as const).map(([mode, label]) => (
                <EditorButton
                  aria-pressed={groupingMode === mode}
                  className="editor-mode-button"
                  isSelected={groupingMode === mode}
                  key={mode}
                  onClick={() => setGroupingMode(mode)}
                >
                  {label}
                </EditorButton>
              ))}
            </div>
          </div>
          <EditorGroupedList
            emptyLabel="No matching events."
            filter={listFilter}
            groups={eventGroups}
            onFilterChange={setListFilter}
            onSelect={(entry) => draft.selectEvent(entry.id)}
            selectedEntryKey={draft.selectedEventId}
          />
          <label className="editor-field"><span>New Event Id</span><input onChange={(event) => draft.setNewEventIdDraft(event.target.value)} value={draft.newEventIdDraft} /></label>
          <EditorButton className="editor-action-button" disabled={!draft.canCreateEvent} onClick={draft.createEvent}>Create Event</EditorButton>
        </EditorPanel></ScrollRegion>
        <ScrollRegion className="workbench__main"><EditorPanel className="editor-panel">
          <h2 className="editor-panel__title">Event</h2>
          {draft.selectedEvent ? <EventForm draft={draft} event={draft.selectedEvent} snapshot={snapshot} areaFirstCell={areaFirstCell} setAreaFirstCell={setAreaFirstCell} setAreaPicker={setAreaPicker} /> : <p className="editor-empty">No event selected.</p>}
        </EditorPanel></ScrollRegion>
        <ScrollRegion className="workbench__inspector"><EditorPanel className="editor-panel">
          <h2 className="editor-panel__title">Problems</h2>
          {draft.selectedEventDiagnostics.length ? <DiagnosticList diagnostics={draft.selectedEventDiagnostics} onNavigate={onNavigate} /> : <p className="editor-empty">No problems.</p>}
          <ReferenceList emptyLabel="No incoming references." onNavigate={onNavigate} references={draft.selectedEventReferences} title="Incoming" useTarget={false} />
          <ReferenceList emptyLabel="No outgoing references." onNavigate={onNavigate} references={draft.outgoingEventReferences} title="Outgoing" useTarget />
        </EditorPanel></ScrollRegion>
      </div>
    </>
  );
}

function EventForm({ draft, event, snapshot, areaFirstCell, setAreaFirstCell, setAreaPicker }: { draft: EventDraftController; event: EventDef; snapshot: ContentCatalogSnapshot; areaFirstCell: GridCell | null; setAreaFirstCell: (cell: GridCell | null) => void; setAreaPicker: (zoneId: string | null) => void }) {
  const update = draft.updateSelectedEvent;
  const triggerType = event.trigger.type;
  function changeTriggerType(type: EventTrigger["type"]): void {
    const zoneId = "zoneId" in event.trigger ? event.trigger.zoneId : draft.zoneIds[0] ?? "";
    const next: EventTrigger = type === "enter_zone" ? { type, zoneId } : type === "step_on_area" || type === "interact_on_area" ? { type, zoneId, area: { x: 0, y: 0, width: 1, height: 1 } } : type === "dialogue_end" ? { type } : type === "quest_state_change" ? { type, questId: draft.questIds[0] ?? "", state: "active" } : { type, minutes: 8 * 60 };
    update((current) => setEventTrigger(current, next));
  }
  return <section className="editor-item-form" aria-label="Event editor">
    <div className="editor-family__header"><h3>{event.eventId}</h3><span>{draft.selectedEventHasUnsavedChanges ? "dirty" : "clean"}</span></div>
    <label className="editor-field"><span>Event Id</span><input disabled readOnly value={event.eventId} /></label>
    <label className="editor-field"><span>Trigger</span><select value={triggerType} onChange={(input) => changeTriggerType(input.target.value as EventTrigger["type"])}>{EVENT_TRIGGER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
    <TriggerFields draft={draft} event={event} snapshot={snapshot} areaFirstCell={areaFirstCell} setAreaFirstCell={setAreaFirstCell} setAreaPicker={setAreaPicker} />
    <label className="editor-field"><span>Repeat Policy</span><select value={typeof event.repeatPolicy === "string" ? event.repeatPolicy : "cooldown"} onChange={(input) => update((current) => ({ ...current, repeatPolicy: input.target.value === "cooldown" ? { type: "cooldown", ticks: 10 } : input.target.value as EventDef["repeatPolicy"] }))}><option value="once_per_playthrough">once per playthrough</option><option value="once_per_visit">once per visit</option><option value="cooldown">cooldown</option></select></label>
    {typeof event.repeatPolicy !== "string" ? <NumberField label="Cooldown ticks" value={event.repeatPolicy.ticks} onChange={(value) => update((current) => ({ ...current, repeatPolicy: { type: "cooldown", ticks: value } }))} /> : null}
    <NumberField label="Priority" value={event.priority} onChange={(value) => update((current) => ({ ...current, priority: value }))} />
    <ListEditor title="Conditions" values={event.conditions} types={EVENT_CONDITION_TYPES} onAdd={(type) => update((current) => addEventCondition(current, type as EventCondition["type"]))} onRemove={(index) => update((current) => removeEventCondition(current, index))} onChange={(index, value) => update((current) => updateCondition(current, index, value))} renderValue={(condition) => condition.type} />
    <ListEditor title="Actions" values={event.actions} types={EVENT_ACTION_TYPES} onAdd={(type) => update((current) => addEventAction(current, type as EventAction["type"]))} onRemove={(index) => update((current) => removeEventAction(current, index))} onChange={(index, value) => update((current) => updateAction(current, index, value))} renderValue={(action) => action.type} />
    <div className="editor-actions"><EditorButton className="editor-action-button" disabled={!draft.canSaveSelectedEvent} onClick={draft.saveSelectedEvent}>Save Event</EditorButton><EditorButton className="editor-action-button" disabled={!draft.canResetSelectedEvent} onClick={draft.resetSelectedEvent}>Reset</EditorButton></div>
    <EditorButton className="editor-action-button" disabled={!draft.canDeleteSelectedEvent} onClick={draft.deleteSelectedEvent}>Delete Event</EditorButton>
    <p aria-live="polite" className={`editor-save-status editor-save-status--${draft.saveStatus.state}`}>{draft.saveStatus.message}</p>
  </section>;
}

function TriggerFields({ draft, event, snapshot, areaFirstCell, setAreaFirstCell, setAreaPicker }: { draft: EventDraftController; event: EventDef; snapshot: ContentCatalogSnapshot; areaFirstCell: GridCell | null; setAreaFirstCell: (cell: GridCell | null) => void; setAreaPicker: (zoneId: string | null) => void }) {
  const update = draft.updateSelectedEvent;
  if (event.trigger.type === "dialogue_end") return <label className="editor-field"><span>Dialogue</span><select value={event.trigger.dialogueId ?? ""} onChange={(input) => update((current) => ({ ...current, trigger: { type: "dialogue_end", dialogueId: input.target.value || undefined } }))}><option value="">Any dialogue</option>{draft.dialogueIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></label>;
  if (event.trigger.type === "quest_state_change") return <div className="editor-form-row"><SelectField label="Quest" value={event.trigger.questId} options={draft.questIds} onChange={(value) => update((current) => ({ ...current, trigger: { ...current.trigger, questId: value } as EventTrigger }))} /><SelectField label="State" value={event.trigger.state} options={["not_started", "active", "readyToComplete", "completed"]} onChange={(value) => update((current) => ({ ...current, trigger: { ...current.trigger, state: value } as EventTrigger }))} /></div>;
  if (event.trigger.type === "calendar_time") return <div className="editor-form-row"><NumberField label="Day" value={event.trigger.day ?? 1} onChange={(value) => update((current) => ({ ...current, trigger: { ...current.trigger, day: value } as EventTrigger }))} /><NumberField label="Minutes" value={event.trigger.minutes} onChange={(value) => update((current) => ({ ...current, trigger: { ...current.trigger, minutes: value } as EventTrigger }))} /></div>;
  const zoneId = "zoneId" in event.trigger ? event.trigger.zoneId : "";
  const area = event.trigger.type === "enter_zone" ? null : event.trigger.area;
  return <><SelectField label="Zone" value={zoneId} options={draft.zoneIds} onChange={(value) => update((current) => ({ ...current, trigger: { ...current.trigger, zoneId: value } as EventTrigger }))} />{area ? <><div className="editor-form-row"><NumberField label="X" value={area.x} onChange={(value) => update((current) => ({ ...current, trigger: { ...current.trigger, area: { ...area, x: value } } as EventTrigger }))} /><NumberField label="Y" value={area.y} onChange={(value) => update((current) => ({ ...current, trigger: { ...current.trigger, area: { ...area, y: value } } as EventTrigger }))} /><NumberField label="Width" value={area.width} onChange={(value) => update((current) => ({ ...current, trigger: { ...current.trigger, area: { ...area, width: value } } as EventTrigger }))} /><NumberField label="Height" value={area.height} onChange={(value) => update((current) => ({ ...current, trigger: { ...current.trigger, area: { ...area, ...area, height: value } } } as unknown as EventDef))} /></div><EditorButton className="editor-compact-button" onClick={() => setAreaPicker(zoneId)}>Pick first corner</EditorButton>{areaFirstCell ? <EditorButton className="editor-compact-button" onClick={() => setAreaPicker(zoneId)}>Pick opposite corner</EditorButton> : null}<span className="editor-placement-hint">{areaFirstCell ? `First corner: (${areaFirstCell.x}, ${areaFirstCell.y})` : "Rectangle area"}</span></> : null}</>;
}

function ListEditor({ title, values, types, onAdd, onRemove, onChange, renderValue }: { title: string; values: ReadonlyArray<EventCondition | EventAction>; types: readonly string[]; onAdd: (type: string) => void; onRemove: (index: number) => void; onChange: (index: number, value: string) => void; renderValue: (value: EventCondition | EventAction) => string }) {
  const [newType, setNewType] = useState(types[0]);
  return <section className="editor-zone-section"><div className="editor-family__header"><h3>{title}</h3><span>{values.length}</span></div>{values.map((value, index) => <div className="editor-form-row" key={index}><span className="editor-placement-hint">{index + 1}. {renderValue(value)}</span><input aria-label={`${title} ${index + 1} value`} value={JSON.stringify(value)} onChange={(input) => onChange(index, input.target.value)} /><EditorButton className="editor-compact-button" onClick={() => onRemove(index)}>Remove</EditorButton></div>)}<div className="editor-form-row"><select aria-label={`New ${title.slice(0, -1)} type`} onChange={(input) => setNewType(input.target.value)} value={newType}>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select><EditorButton className="editor-compact-button" onClick={() => onAdd(newType)}>Add</EditorButton></div></section>;
}

function updateCondition(event: EventDef, index: number, value: string): EventDef { try { const parsed = JSON.parse(value) as EventCondition; const next = structuredClone(event); next.conditions[index] = parsed; return next; } catch { return event; } }
function updateAction(event: EventDef, index: number, value: string): EventDef { try { const parsed = JSON.parse(value) as EventAction; const next = structuredClone(event); next.actions[index] = parsed; return next; } catch { return event; } }
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) { return <label className="editor-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">(select)</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="editor-field"><span>{label}</span><input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>; }
