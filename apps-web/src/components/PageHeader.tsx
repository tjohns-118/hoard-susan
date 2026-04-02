type Props = {
title: string;
subtitle: string;
action?: React.ReactNode;
};

export function PageHeader({ title, subtitle, action }: Props) {
return (
<div className="page-header">
<div>
<h1 className="page-title">{title}</h1>
<p className="page-subtitle">{subtitle}</p>
</div>
{action}
</div>
);
}
