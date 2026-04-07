// Wrapper with description prop — delegates to canonical SectionCard (which uses subtitle)
import { SectionCard as _SectionCard } from '@/components/SectionCard';

type Props = {
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
};

export function SectionCard({ title, description, right, children }: Props) {
  return (
    <_SectionCard title={title} subtitle={description} right={right}>
      {children}
    </_SectionCard>
  );
}
