export function HeroShellCard({
title,
subtitle,
children,
}: {
title: string;
subtitle: string;
children?: React.ReactNode;
}) {
return (
<div className="card hero">
<h1 className="hero-title">{title}</h1>
<p className="hero-subtitle">{subtitle}</p>
{children}
</div>
);
}
