import { useState } from 'react';
import { PaperClipOutlined, PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import {
  Badge,
  Button,
  Col,
  DatePicker,
  Empty,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type {
  Currency,
  FinancialEntry,
  ExpenseFinancialEntry,
  FinancialCategory,
  ExpenseResponse,
  DonationResponse,
} from '@volunteerfleet/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useFinancialEntries } from '../../hooks/useFinancialEntries';
import { useDictionary } from '../../hooks/useDictionaries';
import { useVehicles } from '../../hooks/useVehicles';
import { useDonorsList } from '../../hooks/useDonors';
import { useVehicleDocuments } from '../../hooks/useDocuments';
import { useDeleteExpense } from '../../hooks/useExpenses';
import { useDeleteDonation } from '../../hooks/useDonations';
import { ExpenseFormModal } from '../../modals/ExpenseFormModal';
import { DonationFormModal } from '../../modals/DonationFormModal';
import { DocumentDetailsModal } from '../../modals/DocumentDetailsModal';
import { useAuth, useOrgRole } from '../../stores/auth.store';
import { formatCurrency, formatDate } from '../../utils/format';
import { expensesApi } from '../../api/expenses.api';
import { donationsApi } from '../../api/donations.api';
import type { FinancialEntriesListParams } from '../../api/financial-entries.api';

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

interface ExpenseDocsModalProps {
  vehicleId: string;
  expenseId: string;
  onClose: () => void;
}

function ExpenseDocsModal({ vehicleId, expenseId, onClose }: ExpenseDocsModalProps) {
  const { data } = useVehicleDocuments(vehicleId, { expenseId, pageSize: 100 });
  const documentIds = (data?.items ?? []).map((d) => d.id);
  return (
    <DocumentDetailsModal
      open={documentIds.length > 0}
      documentIds={documentIds}
      onClose={onClose}
    />
  );
}

export function FinancesPage() {
  const queryClient = useQueryClient();
  const orgRole = useOrgRole();
  const user = useAuth((s) => s.user);
  const canMutate = orgRole !== null && orgRole !== 'viewer';

  const [params, setParams] = useState<FinancialEntriesListParams>({
    page: 1,
    pageSize: 20,
  });

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [donationModalOpen, setDonationModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseResponse | undefined>(undefined);
  const [editingDonation, setEditingDonation] = useState<DonationResponse | undefined>(undefined);
  const [docModalExpense, setDocModalExpense] = useState<{
    vehicleId: string;
    expenseId: string;
  } | null>(null);

  const { data, isLoading } = useFinancialEntries(params);
  const { data: categories } = useDictionary('financial-categories');
  const { data: vehiclesData } = useVehicles({ pageSize: 100 });
  const { data: donorsData } = useDonorsList({ isActive: true, pageSize: 200 });

  const deleteExpense = useDeleteExpense();
  const deleteDonation = useDeleteDonation();

  const summary = data?.summary;

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setParams((prev) => ({
      ...prev,
      page: pagination.current ?? 1,
      pageSize: pagination.pageSize ?? 20,
    }));
  };

  const handleEditRow = async (row: FinancialEntry) => {
    if (row.type === 'expense') {
      const expense = await expensesApi.get(row.id);
      setEditingExpense(expense);
      setExpenseModalOpen(true);
    } else {
      const donation = await donationsApi.get(row.id);
      setEditingDonation(donation);
      setDonationModalOpen(true);
    }
  };

  const handleDeleteRow = (row: FinancialEntry) => {
    if (row.type === 'expense') {
      deleteExpense.mutate(row.id, {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ['financial-entries'] });
        },
      });
    } else {
      deleteDonation.mutate(row.id, {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ['financial-entries'] });
        },
      });
    }
  };

  const columns: ColumnsType<FinancialEntry> = [
    {
      title: 'Дата',
      dataIndex: 'entryDate',
      width: 110,
      render: (v: string) => formatDate(v),
    },
    {
      title: 'Тип',
      dataIndex: 'type',
      width: 100,
      render: (type: 'expense' | 'donation') =>
        type === 'expense' ? <Tag color="red">Витрата</Tag> : <Tag color="green">Донат</Tag>,
    },
    {
      title: 'Сума',
      key: 'amount',
      align: 'right',
      width: 140,
      render: (_: unknown, row: FinancialEntry) => (
        <span style={{ color: row.type === 'expense' ? '#cf1322' : '#389e0d' }}>
          {formatCurrency(row.amountMinor, row.currency as Currency)}
        </span>
      ),
    },
    {
      title: 'UAH ≈',
      key: 'amountUah',
      align: 'right',
      width: 140,
      render: (_: unknown, row: FinancialEntry) =>
        row.currency !== 'UAH' ? formatCurrency(row.amountUahMinor, 'UAH') : null,
    },
    {
      title: 'Авто',
      key: 'vehicle',
      render: (_: unknown, row: FinancialEntry) => (
        <Link to={`/vehicles/${row.vehicle.id}`}>{row.vehicle.identifier}</Link>
      ),
    },
    {
      title: 'Деталі',
      key: 'details',
      render: (_: unknown, row: FinancialEntry) => {
        if (row.type === 'expense') {
          return <Tag>{row.category.name}</Tag>;
        }
        return row.donor.name;
      },
    },
    {
      title: 'Опис',
      dataIndex: 'description',
      width: 220,
      ellipsis: true,
      render: renderDescription,
    },
    {
      title: 'Документи',
      key: 'documents',
      width: 90,
      align: 'center',
      render: (_: unknown, row: FinancialEntry) => {
        if (row.type !== 'expense') return null;
        const expenseRow = row as ExpenseFinancialEntry;
        const count = expenseRow.documentCount;
        return (
          <Tooltip title={count > 0 ? 'Переглянути документи' : 'Немає документів'}>
            <Badge count={count} size="small">
              <Button
                type="text"
                icon={<PaperClipOutlined />}
                disabled={count === 0}
                onClick={() => setDocModalExpense({ vehicleId: row.vehicle.id, expenseId: row.id })}
              />
            </Badge>
          </Tooltip>
        );
      },
    },
    ...(canMutate
      ? [
          {
            title: 'Дії',
            key: 'actions',
            width: 90,
            align: 'center' as const,
            render: (_: unknown, row: FinancialEntry) => (
              <Space size={0}>
                <Tooltip title="Редагувати">
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => void handleEditRow(row)}
                  />
                </Tooltip>
                <Popconfirm
                  title="Видалити запис?"
                  okText="Так"
                  cancelText="Ні"
                  onConfirm={() => handleDeleteRow(row)}
                >
                  <Tooltip title="Видалити">
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Tooltip>
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
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
          Фінанси
        </Typography.Title>
        {canMutate && (
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingExpense(undefined);
                setExpenseModalOpen(true);
              }}
            >
              Додати витрату
            </Button>
            <Button
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingDonation(undefined);
                setDonationModalOpen(true);
              }}
            >
              Додати донат
            </Button>
          </Space>
        )}
      </div>

      {/* KPI summary */}
      <Row gutter={24}>
        <Col xs={24} sm={8}>
          <Statistic
            title="Витрати"
            value={summary ? formatCurrency(summary.expensesUahMinor, 'UAH') : '—'}
            valueStyle={{ color: '#cf1322' }}
          />
        </Col>
        <Col xs={24} sm={8}>
          <Statistic
            title="Донати"
            value={summary ? formatCurrency(summary.donationsUahMinor, 'UAH') : '—'}
            valueStyle={{ color: '#389e0d' }}
          />
        </Col>
        <Col xs={24} sm={8}>
          <Statistic
            title="Баланс"
            value={summary ? formatCurrency(summary.balanceUahMinor, 'UAH') : '—'}
            valueStyle={{
              color: summary && summary.balanceUahMinor >= 0 ? '#389e0d' : '#cf1322',
            }}
          />
        </Col>
      </Row>

      {/* Filters */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} md={4}>
          <Select
            style={{ width: '100%' }}
            defaultValue={undefined}
            placeholder="Тип"
            allowClear
            options={[
              { value: 'expense', label: 'Витрати' },
              { value: 'donation', label: 'Донати' },
            ]}
            onChange={(val: 'expense' | 'donation' | undefined) =>
              setParams((p) => ({ ...p, type: val, page: 1 }))
            }
          />
        </Col>
        <Col xs={24} sm={12} md={5}>
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
        <Col xs={24} sm={12} md={5}>
          <Select
            allowClear
            placeholder="Категорія"
            style={{ width: '100%' }}
            options={((categories as FinancialCategory[] | undefined) ?? []).map((c) => ({
              value: c.id,
              label: c.name,
            }))}
            onChange={(val: string | undefined) =>
              setParams((p) => ({ ...p, categoryId: val, page: 1 }))
            }
          />
        </Col>
        <Col xs={24} sm={12} md={5}>
          <Select
            allowClear
            showSearch
            placeholder="Донор"
            style={{ width: '100%' }}
            optionFilterProp="label"
            options={(donorsData?.items ?? []).map((d) => ({
              value: d.id,
              label: d.name,
            }))}
            onChange={(val: string | undefined) =>
              setParams((p) => ({ ...p, donorId: val, page: 1 }))
            }
          />
        </Col>
        <Col xs={24} sm={12} md={3}>
          <Select
            allowClear
            placeholder="Валюта"
            style={{ width: '100%' }}
            options={[
              { value: 'UAH', label: 'UAH' },
              { value: 'USD', label: 'USD' },
              { value: 'EUR', label: 'EUR' },
            ]}
            onChange={(val: string | undefined) =>
              setParams((p) => ({ ...p, currency: val, page: 1 }))
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
        scroll={{ x: 1100 }}
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
        open={expenseModalOpen}
        expense={editingExpense}
        onClose={() => {
          setExpenseModalOpen(false);
          setEditingExpense(undefined);
        }}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: ['financial-entries'] });
        }}
      />

      <DonationFormModal
        open={donationModalOpen}
        donation={editingDonation}
        onClose={() => {
          setDonationModalOpen(false);
          setEditingDonation(undefined);
        }}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: ['financial-entries'] });
        }}
      />

      {docModalExpense && (
        <ExpenseDocsModal
          vehicleId={docModalExpense.vehicleId}
          expenseId={docModalExpense.expenseId}
          onClose={() => setDocModalExpense(null)}
        />
      )}
    </Space>
  );
}
