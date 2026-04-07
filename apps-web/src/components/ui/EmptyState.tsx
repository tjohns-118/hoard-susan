// Wrapper accepting title + description props for shell/placeholder pages
type Props = {
  title?: string;
  description?: string;
};

export function EmptyState({ title, description }: Props) {
  return (
    <div className="card empty">
      {title && <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>}
      {description && <div className="muted small">{description}</div>}
    </div>
  );
}
