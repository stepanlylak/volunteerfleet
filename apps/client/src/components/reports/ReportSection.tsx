import { Typography } from 'antd';
import type { ReactNode } from 'react';

interface ReportSectionProps {
  title: string;
  children: ReactNode;
}

export function ReportSection({ title, children }: ReportSectionProps) {
  return (
    <section className="report-section">
      <Typography.Title level={4}>{title}</Typography.Title>
      {children}
    </section>
  );
}
