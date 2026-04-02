type Props = {
children: React.ReactNode;
tone?: "success" | "warn" | "danger" | "info";
};

export function StatusBadge({ children, tone = "info" }: Props) {
return <span className={`badge ${tone}`}>{children}</span>;
}
