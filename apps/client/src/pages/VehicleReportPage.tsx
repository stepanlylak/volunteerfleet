import {
  Card,
  Descriptions,
  Empty,
  List,
  Skeleton,
  Space,
  Statistic,
  Table,
  Timeline,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useParams } from 'react-router-dom';
import {
  VEHICLE_STATUS_CONFIG,
  type DocumentResponse,
  type ExpenseCurrencyBreakdown,
  type ExpenseResponse,
  type FinancialCategoryBreakdown,
} from '@volunteerfleet/shared';
import { VehicleStatusTag } from '../components/VehicleStatusTag';
import { ReportSection } from '../components/reports/ReportSection';
import { ReportToolbar } from '../components/reports/ReportToolbar';
import { documentsApi } from '../api/documents.api';
import { useVehicleReport } from '../hooks/useReports';
import { formatCurrency, formatDate } from '../utils/format';

export function VehicleReportPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useVehicleReport(id);

  if (isLoading) return <Skeleton active />;
  if (!data) return <Empty description="Звіт не знайдено" />;

  const { vehicle } = data;
  const title = `Звіт по авто ${vehicle.identifier} ${vehicle.brand} ${vehicle.model}`;

  const currencyColumns: ColumnsType<ExpenseCurrencyBreakdown> = [
    { title: 'Валюта', dataIndex: 'currency' },
    {
      title: 'Сума у валюті',
      dataIndex: 'totalInCurrencyMinor',
      align: 'right',
      render: (value: number, row) => formatCurrency(value, row.currency),
    },
    {
      title: 'Еквівалент UAH',
      dataIndex: 'totalUahMinor',
      align: 'right',
      render: (value: number) => formatCurrency(value, 'UAH'),
    },
  ];

  const categoryColumns: ColumnsType<FinancialCategoryBreakdown> = [
    { title: 'Категорія', dataIndex: 'category' },
    {
      title: 'Сума UAH',
      dataIndex: 'totalUahMinor',
      align: 'right',
      render: (value: number) => formatCurrency(value, 'UAH'),
    },
  ];

  const expenseColumns: ColumnsType<ExpenseResponse> = [
    { title: 'Дата', dataIndex: 'expenseDate', render: (value: string) => formatDate(value) },
    { title: 'Категорія', dataIndex: ['category', 'name'] },
    {
      title: 'Сума',
      key: 'amount',
      align: 'right',
      render: (_, row) => formatCurrency(row.amountMinor, row.currency),
    },
    {
      title: 'UAH',
      key: 'uah',
      align: 'right',
      render: (_, row) => formatCurrency(Math.round(row.amountMinor * row.rate), 'UAH'),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <ReportToolbar />

      <div className="print-area">
        <Typography.Title level={2}>{title}</Typography.Title>
        <Typography.Text type="secondary">
          Сформовано {new Date().toLocaleDateString('uk-UA')}
        </Typography.Text>

        <ReportSection title="Основні дані">
          <Card>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="Внутрішній номер">{vehicle.identifier}</Descriptions.Item>
              <Descriptions.Item label="Марка і модель">
                {vehicle.brand} {vehicle.model}
              </Descriptions.Item>
              <Descriptions.Item label="Рік">{vehicle.year ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Статус">
                <VehicleStatusTag status={vehicle.status} />
              </Descriptions.Item>
              <Descriptions.Item label="VIN">{vehicle.vin ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Опис">{vehicle.description ?? '—'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </ReportSection>

        <ReportSection title="Зведення">
          <Space wrap size="large">
            <Statistic title="Загальна сума" value={formatCurrency(data.totalUahMinor, 'UAH')} />
            <Statistic title="Кількість витрат" value={data.expenses.length} />
            <Statistic title="Кількість документів" value={data.documents.length} />
          </Space>
        </ReportSection>

        <ReportSection title="Розбивка по валютах">
          <Table
            rowKey="currency"
            columns={currencyColumns}
            dataSource={data.byCurrency}
            pagination={false}
            size="small"
          />
        </ReportSection>

        <ReportSection title="Розбивка по категоріях">
          <Table
            rowKey="category"
            columns={categoryColumns}
            dataSource={data.byCategory}
            pagination={false}
            size="small"
          />
        </ReportSection>

        <ReportSection title="Історія статусів">
          <Timeline
            items={data.statusHistory.map((item) => ({
              children: (
                <Space direction="vertical" size={0}>
                  <span>
                    {item.oldStatus ? VEHICLE_STATUS_CONFIG[item.oldStatus]?.label : 'Старт'} →{' '}
                    {VEHICLE_STATUS_CONFIG[item.newStatus]?.label ?? '—'}
                  </span>
                  <Typography.Text type="secondary">
                    {formatDate(item.changedAt)} · {item.changedBy.fullName}
                  </Typography.Text>
                </Space>
              ),
            }))}
          />
        </ReportSection>

        <ReportSection title="Витрати">
          <Table
            rowKey="id"
            columns={expenseColumns}
            dataSource={data.expenses}
            pagination={false}
            size="small"
          />
        </ReportSection>

        <ReportSection title="Документи">
          <List<DocumentResponse>
            dataSource={data.documents}
            locale={{ emptyText: 'Документів немає' }}
            renderItem={(doc) => {
              const href =
                doc.kind === 'link' ? doc.url : documentsApi.getDownloadUrl(doc.id, doc.updatedAt);
              return (
                <List.Item>
                  <List.Item.Meta
                    title={
                      href ? (
                        <a href={href} target="_blank" rel="noreferrer">
                          {doc.name}
                        </a>
                      ) : (
                        doc.name
                      )
                    }
                    description={
                      <span>
                        {doc.kind === 'upload' ? 'Файл' : 'Посилання'}
                        {href ? ` · ${href}` : ''}
                      </span>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </ReportSection>
      </div>
    </Space>
  );
}
