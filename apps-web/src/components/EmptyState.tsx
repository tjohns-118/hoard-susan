type Props = {
children: React.ReactNode;
};

export function EmptyState({ children }: Props) {
return <div className="card empty">{children}</div>;
}
