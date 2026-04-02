type Props = {
label: string;
value: string | number;
meta?: string;
};

export function StatCard({ label, value, meta }: Props) {
return (
<div className="card card-pad">
<div className="stat-label">{label}</div>
<div className="stat-value">{value}</div>
{meta ? <div className="muted small">{meta}</div> : null}
</div>
);
}
