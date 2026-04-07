interface StatCardProps {
label: string;
value: string | number;
subtext?: string;
}

export function StatCard({ label, value, subtext }: StatCardProps) {
return (
<div
style={{
padding: 20,
borderRadius: 18,
background: 'rgba(255,255,255,0.045)',
border: '1px solid rgba(255,255,255,0.08)',
boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
}}
>
<div
style={{
fontSize: 12,
textTransform: 'uppercase',
letterSpacing: '0.08em',
color: 'rgba(255,255,255,0.58)',
marginBottom: 10,
fontWeight: 700,
}}
>
{label}
</div>

<div
style={{
fontSize: 34,
fontWeight: 800,
letterSpacing: '-0.04em',
color: '#ffffff',
lineHeight: 1,
}}
>
{value}
</div>

{subtext ? (
<div
style={{
marginTop: 10,
fontSize: 13,
color: 'rgba(255,255,255,0.6)',
}}
>
{subtext}
</div>
) : null}
</div>
);
}