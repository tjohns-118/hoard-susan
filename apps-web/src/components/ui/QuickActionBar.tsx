// Horizontal row of action buttons, used in topbar/page header areas
type Props = {
  children: React.ReactNode;
};

export function QuickActionBar({ children }: Props) {
  return (
    <div className="row" style={{ gap: 10 }}>
      {children}
    </div>
  );
}
