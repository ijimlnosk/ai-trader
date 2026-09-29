/** Large, accessible on/off switch. It only reports intent; callers confirm before acting. */
export function Switch(props: { checked: boolean; label: string; disabled?: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={props.checked} aria-label={props.label} disabled={props.disabled}
      className={`switch ${props.checked ? 'switch-on' : ''}`} onClick={props.onToggle}>
      <span className="switch-thumb" />
    </button>
  );
}
