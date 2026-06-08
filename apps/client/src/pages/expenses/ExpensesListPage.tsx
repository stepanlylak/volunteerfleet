import { useState } from 'react';
import { EyeOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  DatePicker,
  Empty,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { SorterResult } from 'antd/es/table/interface';
import type { ExpenseCategory, ExpenseResponse, FundingSource } from '@volunteerfleet/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ExpensesListParams } from '../../api/expenses.api';
import { useExpensesList } from '../../hooks/useExpenses';
import { useDictionary } from '../../hooks/useDictionaries';
import { useVehicles } from '../../hooks/useVehicles';
import { ExpenseFormModal } from '../../modals/ExpenseFormModal';
import { useAuth, useOrgRole } from '../../stores/auth.store';

const { RangePicker } = DatePicker;

function renderDescription(value: string | null) {
  const text = value?.trim() || '—';
  return (
    <span
      title={value?.trim() || undefined}
      style={{
        display: 'block',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
}

export function ExpensesListPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const orgRole = useOrgRole();
  const user = useAuth((s) => s.user);
  const canMutate = orgRole !== null && orgRole !== 'viewer';
  const [params, setParams] = useState<ExpensesListParams>({
    page: 1,
    pageSize: 20,
    sort: '-expenseDate',
  });

  const { data, isLoading } = useExpensesList(params);
  const { data: categories } = useDictionary('expense-categories');
  const { data: fundingSources } = useDictionary('funding-sources');
  const { data: vehiclesData } = useVehicles({ pageSize: 100 });

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _: unknown,
    sorter: SorterResult<ExpenseResponse> | SorterResult<ExpenseResponse>[],
  ) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    let sort = '-expenseDate';
    if (s?.field && s?.order) {
      const field = s.field as string;
      sort = s.order === 'descend' ? `-${field}` : field;
    }
    setParams((prev) => ({
      ...prev,
      page: pagination.current ?? 1,
      pageSize: pagination.pageSize ?? 20,
      sort,
    }));
  };

  const columns: ColumnsType<ExpenseResponse> = [
    {
      title: 'Дата',
      dataIndex: 'expenseDate',
      width: 120,
      sorter: true,
      defaultSortOrder: 'descend',
      render: (v: string) => new Date(v).toLocaleDateString('uk-UA'),
    },
    {
      title: 'Авто',
      key: 'vehicle',
      render: (_: unknown, row: ExpenseResponse) =>
        row.vehicle ? (
          <Link to={`/vehicles/${row.vehicle.id}`}>
            {row.vehicle.identifier}
            {row.vehicle.brand ? ` · ${row.vehicle.brand}` : ''}
            {row.vehicle.model ? ` ${row.vehicle.model}` : ''}
          </Link>
        ) : (
          '—'
        ),
    },
    {
      title: 'Категорія',
      dataIndex: ['category', 'name'],
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Сума',
      dataIndex: 'amount',
      align: 'right',
      sorter: true,
      render: (v: string, row: ExpenseResponse) => `${v} ${row.currency}`,
    },
    {
      title: 'Джерело',
      dataIndex: ['fundingSource', 'name'],
      render: (v: string) => v ?? '—',
    },
    {
      title: 'Опис',
      dataIndex: 'description',
      width: 260,
      ellipsis: true,
      render: renderDescription,
    },
    {
      title: 'Дії',
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_: unknown, row: ExpenseResponse) =>
        row.vehicle ? (
          <Tooltip title="Переглянути авто">
            <Link to={`/vehicles/${row.vehicle.id}`}>
              <Button type="text" icon={<EyeOutlined />} aria-label="Переглянути авто" />
            </Link>
          </Tooltip>
        ) : (
          <Button type="text" icon={<EyeOutlined />} aria-label="Переглянути авто" disabled />
        ),
    },
  ];

  if (user && !user.activeOrgId) {
    return (
      <Empty
        description={
          <Typography.Text>
            {user.userRole === 'superuser'
              ? 'Активна організація не вибрана. Оберіть організацію у верхньому меню.'
              : 'Вас ще не додано до жодної організації. Зверніться до координатора.'}
          </Typography.Text>
        }
      />
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Витрати
        </Typography.Title>
        {canMutate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Додати витрату
          </Button>
        )}
      </div>

      {/* Filters */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} md={6}>
          <Select
            allowClear
            showSearch
            placeholder="Авто"
            style={{ width: '100%' }}
            optionFilterProp="label"
            options={(vehiclesData?.items ?? []).map((v) => ({
              value: v.id,
              label: `${v.identifier} · ${v.brand ?? ''} ${v.model ?? ''}`.trim(),
            }))}
            onChange={(val: string | undefined) =>
              setParams((p) => ({ ...p, vehicleId: val, page: 1 }))
            }
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Select
            allowClear
            placeholder="Категорія"
            style={{ width: '100%' }}
            options={((categories as ExpenseCategory[] | undefined) ?? []).map((c) => ({
              value: c.id,
              label: c.name,
            }))}
            onChange={(val: string | undefined) =>
              setParams((p) => ({ ...p, categoryId: val, page: 1 }))
            }
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Select
            allowClear
            placeholder="Джерело"
            style={{ width: '100%' }}
            options={((fundingSources as FundingSource[] | undefined) ?? []).map((f) => ({
              value: f.id,
              label: f.name,
            }))}
            onChange={(val: string | undefined) =>
              setParams((p) => ({ ...p, fundingSourceId: val, page: 1 }))
            }
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <RangePicker
            style={{ width: '100%' }}
            onChange={(dates) => {
              if (!dates) {
                setParams((p) => ({ ...p, dateFrom: undefined, dateTo: undefined, page: 1 }));
                return;
              }
              setParams((p) => ({
                ...p,
                dateFrom: dates[0]?.format('YYYY-MM-DD'),
                dateTo: dates[1]?.format('YYYY-MM-DD'),
                page: 1,
              }));
            }}
          />
        </Col>
      </Row>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data?.items ?? []}
        columns={columns}
        scroll={{ x: 960 }}
        onChange={handleTableChange}
        pagination={{
          current: params.page,
          pageSize: params.pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showTotal: (total: number) => `Всього: ${total}`,
        }}
      />

      <ExpenseFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: ['expenses', 'list'] });
        }}
      />
    </Space>
  );
}
