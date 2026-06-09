import { DatePicker, Empty, Progress, Skeleton, Space, Statistic, Table, Typography } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { Link, useParams } from 'react-router-dom';
import type {
  ExpenseCategoryBreakdown,
  ExpenseResponse,
  VehicleExpenseBreakdown,
} from '@volunteerfleet/shared';
import { ReportSection } from '../components/reports/ReportSection';
import { ReportToolbar } from '../components/reports/ReportToolbar';
import { useFundingSourceReport } from '../hooks/useReports';
import { formatCurrency, formatDate } from '../utils/format';
import { useState } from 'react';

const { RangePicker } = DatePicker;

type ReportRange = [Dayjs, Dayjs];

export function FundingSourceReportPage() {
  const { id } = useParams<{ id: string }>();
  const [range, setRange] = useState<ReportRange>(() => [dayjs().subtract(30, 'day'), dayjs()]);
  const query = {
    dateFrom: range[0].format('YYYY-MM-DD'),
    dateTo: range[1].format('YYYY-MM-DD'),
  };
  const { data, isLoading } = useFundingSourceReport(id, query);

  if (isLoading) return <Skeleton active />;
  if (!data) return <Empty description="Звіт не знайдено" />;

  const maxCategory = Math.max(...data.byCategory.map((row) => row.totalUahMinor), 1);

  const categoryColumns: ColumnsType<ExpenseCategoryBreakdown> = [
    { title: 'Категорія', dataIndex: 'category' },
    {
      title: 'Частка',
      key: 'progress',
      width: 220,
      render: (_, row) => (
        <Progress
          percent={Math.round((row.totalUahMinor / maxCategory) * 100)}
          showInfo={false}
          strokeColor="#1677ff"
        />
      ),
    },
    {
      title: 'Сума UAH',
      dataIndex: 'totalUahMinor',
      align: 'right',
      render: (value: number) => formatCurrency(value, 'UAH'),
    },
  ];

  const vehicleColumns: ColumnsType<VehicleExpenseBreakdown> = [
    {
      title: 'Авто',
      key: 'vehicle',
      render: (_, row) =>
        row.vehicle ? (
          <Link to={`/vehicles/${row.vehicle.id}`}>
            {row.vehicle.identifier} · {row.vehicle.brand} {row.vehicle.model}
          </Link>
        ) : (
          'Без авто'
        ),
    },
    {
      title: 'Сума UAH',
      dataIndex: 'totalUahMinor',
      align: 'right',
      render: (value: number) => formatCurrency(value, 'UAH'),
    },
  ];

  const expenseColumns: ColumnsType<ExpenseResponse> = [
    { title: 'Дата', dataIndex: 'expenseDate', render: (value: string) => formatDate(value) },
    {
      title: 'Авто',
      key: 'vehicle',
      render: (_, row) =>
        row.vehicle
          ? `${row.vehicle.identifier} · ${row.vehicle.brand} ${row.vehicle.model}`
          : 'Без авто',
    },
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
      <ReportToolbar
        extra={
          <RangePicker
            value={range}
            format="DD.MM.YYYY"
            allowClear={false}
            onChange={(value) => {
              if (value?.[0] && value[1]) {
                setRange([value[0], value[1]]);
              }
            }}
          />
        }
      />

      <div className="print-area">
        <Typography.Title level={2}>
          Звіт по джерелу {data.fundingSource.name} за період {formatDate(query.dateFrom)}–
          {formatDate(query.dateTo)}
        </Typography.Title>

        <ReportSection title="Зведення">
          <Statistic title="Загальна сума" value={formatCurrency(data.totalUahMinor, 'UAH')} />
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

        <ReportSection title="Розбивка по авто">
          <Table
            rowKey={(row) => row.vehicle?.id ?? 'none'}
            columns={vehicleColumns}
            dataSource={data.byVehicle}
            pagination={false}
            size="small"
          />
        </ReportSection>

        <ReportSection title="Перелік витрат">
          <Table
            rowKey="id"
            columns={expenseColumns}
            dataSource={data.expenses}
            pagination={false}
            size="small"
          />
        </ReportSection>
      </div>
    </Space>
  );
}
