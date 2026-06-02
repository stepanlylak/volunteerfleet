import { Empty, Progress, Result, Skeleton, Space, Statistic, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ExpenseCategoryBreakdown, VehicleExpenseBreakdown } from '@volunteerfleet/shared';
import { publicApi } from '../../api/public.api';
import { formatCurrency, formatDate } from '../../utils/format';

export function PublicFundingReportPage() {
  const { id } = useParams<{ id: string }>();
  const query = {
    dateFrom: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    dateTo: dayjs().format('YYYY-MM-DD'),
  };
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public', 'funding-report', id, query],
    queryFn: () => publicApi.getFundingReport(id!, query),
    enabled: Boolean(id),
    retry: false,
  });

  if (isLoading) return <Skeleton active />;
  if (isError || !data) {
    return <Result status="404" title="Сторінка не знайдена або недоступна" />;
  }

  const maxCategory = Math.max(...data.byCategory.map((row) => row.totalUah), 1);

  const categoryColumns: ColumnsType<ExpenseCategoryBreakdown> = [
    { title: 'Категорія', dataIndex: 'category' },
    {
      title: 'Частка',
      key: 'progress',
      width: 220,
      render: (_, row) => (
        <Progress percent={Math.round((row.totalUah / maxCategory) * 100)} showInfo={false} />
      ),
    },
    {
      title: 'Сума',
      dataIndex: 'totalUah',
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
          <Link to={`/public/vehicles/${row.vehicle.publicSlug}`}>
            {row.vehicle.identifier} · {row.vehicle.brand} {row.vehicle.model}
          </Link>
        ) : (
          'Публічне авто'
        ),
    },
    {
      title: 'Сума',
      dataIndex: 'totalUah',
      align: 'right',
      render: (value: number) => formatCurrency(value, 'UAH'),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2}>{data.fundingSource.name}</Typography.Title>
        <Typography.Text type="secondary">
          Публічний звіт за період {formatDate(data.dateFrom ?? query.dateFrom)}–
          {formatDate(data.dateTo ?? query.dateTo)}
        </Typography.Text>
      </div>

      <Statistic title="Загальна сума" value={data.totalUah} precision={2} suffix="₴" />

      <Table
        rowKey="category"
        columns={categoryColumns}
        dataSource={data.byCategory}
        pagination={false}
        locale={{ emptyText: <Empty description="Даних за категоріями немає" /> }}
      />

      <Table
        rowKey={(row) => row.vehicle?.id ?? 'none'}
        columns={vehicleColumns}
        dataSource={data.byVehicle}
        pagination={false}
        locale={{ emptyText: <Empty description="Публічних авто у звіті немає" /> }}
      />
    </Space>
  );
}
