import { PrinterOutlined } from '@ant-design/icons';
import { Alert, Button, Space } from 'antd';
import type { ReactNode } from 'react';

interface ReportToolbarProps {
  extra?: ReactNode;
}

export function ReportToolbar({ extra }: ReportToolbarProps) {
  return (
    <Space className="no-print" direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
        {extra ?? <span />}
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          Зберегти як PDF
        </Button>
      </Space>
      <Alert
        type="info"
        showIcon
        message="Налаштування друку браузера: Поля = Стандартні; Фон і графіка = вимк."
      />
    </Space>
  );
}
