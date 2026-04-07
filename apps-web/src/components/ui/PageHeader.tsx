// Wrapper with description prop — delegates to canonical PageHeader (which uses subtitle)
import { PageHeader as _PageHeader } from '@/components/PageHeader';

type Props = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, description, action }: Props) {
  return <_PageHeader title={title} subtitle={description ?? ''} action={action} />;
}
