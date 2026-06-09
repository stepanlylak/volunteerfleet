import { useMemo, useState } from 'react';
import { PlusOutlined, WarningOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Select, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import {
  VEHICLE_STATUS_CONFIG,
  type VehicleResponse,
  type VehicleStatus,
} from '@volunteerfleet/shared';
import { VehicleFormModal } from '../../modals/VehicleFormModal';
import { useVehicles } from '../../hooks/useVehicles';
import { useAuth, useOrgRole } from '../../stores/auth.store';

export function VehiclesListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<VehicleStatus | undefined>();
  const [hasAlerts, setHasAlerts] = useState<boolean | undefined>();
  const [sort, setSort] = useState('createdAt:desc');
  const [modalOpen, setModalOpen] = useState(false);
  const orgRole = useOrgRole();
  const user = useAuth((s) => s.user);
  const canMutate = orgRole !== null && orgRole !== 'viewer';
  const { data, isFetching } = useVehicles({
    page,
    pageSize,
    search: search || undefined,
    status,
    hasAlerts,
    sort,
  });

  const columns = useMemo<ColumnsType<VehicleResponse>>(
    () => [
      {
        title: 'Ідентифікатор',
        dataIndex: 'identifier',
        sorter: true,
      },
      {
        title: 'Марка і модель',
        key: 'model',
        sorter: true,
        render: (_, vehicle) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>
              {vehicle.brand} {vehicle.model}
            </Typography.Text>
            {vehicle.vin ? (
              <Typography.Text type="secondary">VIN: {vehicle.vin}</Typography.Text>
            ) : null}
          </Space>
        ),
      },
      {
        title: 'Рік',
        dataIndex: 'year',
        sorter: true,
        width: 100,
        render: (year: number | null) => year ?? '—',
      },
      {
        title: 'Статус',
        dataIndex: 'status',
        render: (status: VehicleStatus, vehicle: VehicleResponse) => (
          <Space size="small">
            <Tag color={VEHICLE_STATUS_CONFIG[status].color}>
              {VEHICLE_STATUS_CONFIG[status].label}
            </Tag>
            {vehicle.alerts.length > 0 && (
              <Tooltip title={vehicle.alerts.map((a) => a.message).join('; ')}>
                <WarningOutlined style={{ color: '#faad14' }} />
              </Tooltip>
            )}
          </Space>
        ),
      },
      {
        title: 'Створено',
        dataIndex: 'createdAt',
        sorter: true,
        render: (value: string) => dayjs(value).format('DD.MM.YYYY HH:mm'),
      },
    ],
    [],
  );

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _: Record<string, FilterValue | null>,
    sorter: SorterResult<VehicleResponse> | SorterResult<VehicleResponse>[],
  ) => {
    setPage(pagination.current ?? 1);
    setPageSize(pagination.pageSize ?? 20);
    const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    if (singleSorter?.field && singleSorter.order) {
      const field = Array.isArray(singleSorter.field)
        ? singleSorter.field.join('.')
        : String(singleSorter.field);
      setSort(`${field}:${singleSorter.order === 'ascend' ? 'asc' : 'desc'}`);
    }
  };

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
      <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Автомобілі
        </Typography.Title>
        {canMutate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Додати авто
          </Button>
        )}
      </Space>
      <Space wrap>
        <Input.Search
          allowClear
          placeholder="Пошук за маркою, моделлю, VIN"
          style={{ width: 320 }}
          onSearch={(value) => {
            setPage(1);
            setSearch(value.trim());
          }}
        />
        <Select
          allowClear
          placeholder="Статус"
          style={{ width: 240 }}
          value={status}
          onChange={(value) => {
            setPage(1);
            setStatus(value);
          }}
          options={Object.entries(VEHICLE_STATUS_CONFIG).map(([value, config]) => ({
            value,
            label: config.label,
          }))}
        />
        <Space size="small">
          <Switch
            checked={hasAlerts === true}
            onChange={(checked) => {
              setPage(1);
              setHasAlerts(checked ? true : undefined);
            }}
          />
          <Typography.Text>З алертами</Typography.Text>
        </Space>
      </Space>
      <Table
        rowKey="id"
        loading={isFetching}
        columns={columns}
        dataSource={data?.items ?? []}
        pagination={{
          current: data?.page ?? page,
          pageSize: data?.pageSize ?? pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
        }}
        onChange={handleTableChange}
        onRow={(vehicle) => ({
          onClick: () => navigate(`/vehicles/${vehicle.id}`),
          style: { cursor: 'pointer' },
        })}
      />
      {canMutate && <VehicleFormModal open={modalOpen} onClose={() => setModalOpen(false)} />}
    </Space>
  );
}
