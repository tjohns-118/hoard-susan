type Props = {
title: string;
subtitle?: string;
right?: React.ReactNode;
children: React.ReactNode;
};

export function SectionCard({ title, subtitle, right, children }: Props) {
return (
<section className="card card-pad">
<div className="row" style={{ marginBottom: 16 }}>
<div>
<h2 className="section-title">{title}</h2>
{subtitle ? <div className="section-subtitle">{subtitle}</div> : null}
</div>
{right}
</div>
{children}
</section>
);
}
