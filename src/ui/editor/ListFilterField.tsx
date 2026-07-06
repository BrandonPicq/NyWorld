type ListFilterFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function ListFilterField({
  label,
  value,
  onChange,
}: ListFilterFieldProps) {
  return (
    <label className="editor-field editor-list-filter">
      <span>{label}</span>
      <input
        onChange={(event) => onChange(event.target.value)}
        placeholder="id or name"
        type="search"
        value={value}
      />
    </label>
  );
}
