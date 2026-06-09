import { useMemo, useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import {
  Badge,
  Button,
  Empty,
  Image,
  Input,
  Space,
  Switch,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import {
  VEHICLE_STATUS_CONFIG,
  VEHICLE_STATUSES,
  type VehicleResponse,
  type VehicleStatus,
} from '@volunteerfleet/shared';
import { VehicleFormModal } from '../../modals/VehicleFormModal';
import {
  VehicleStatusTag,
  softColorStyle,
  solidColorStyle,
} from '../../components/VehicleStatusTag';
import { useVehicles } from '../../hooks/useVehicles';
import { useAuth, useOrgRole } from '../../stores/auth.store';
import { vehiclesApi } from '../../api/vehicles.api';

export function VehiclesListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<VehicleStatus[]>([]);
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
    statuses: statuses.length > 0 ? statuses : undefined,
    hasAlerts,
    sort,
  });

  const columns = useMemo<ColumnsType<VehicleResponse>>(
    () => [
      {
        title: 'Обкладинка',
        key: 'cover',
        width: 100,
        render: (_, vehicle) =>
          vehicle.mainGalleryCover ? (
            <Image
              width={80}
              height={60}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              src={vehiclesApi.getMainCoverUrl(vehicle.mainGalleryCover.itemId)}
              alt={`${vehicle.brand} ${vehicle.model}`}
              preview={false}
              placeholder
            />
          ) : (
            <div
              style={{
                width: 80,
                height: 60,
                borderRadius: 4,
                backgroundColor: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: 12,
              }}
            >
              Немає фото
            </div>
          ),
      },
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
            <VehicleStatusTag status={status} />
            {vehicle.alerts.length > 0 && (
              <Tooltip title={vehicle.alerts.map((a) => a.message).join('; ')}>
                <Badge count={vehicle.alerts.length} color="#faad14" />
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
      <div className="vehicle-filters">
        <div className="vehicle-filters__top">
          <Input.Search
            allowClear
            placeholder="Пошук за маркою, моделлю, VIN"
            style={{ maxWidth: 360, width: '100%' }}
            onSearch={(value) => {
              setPage(1);
              setSearch(value.trim());
            }}
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
        </div>
        <div className="status-filter">
          <Typography.Text type="secondary" className="status-filter__label">
            Статус
          </Typography.Text>
          {VEHICLE_STATUSES.map((s) => {
            const cfg = VEHICLE_STATUS_CONFIG[s];
            const active = statuses.includes(s);
            return (
              <button
                key={s}
                type="button"
                className={`status-chip${active ? ' status-chip--active' : ''}`}
                style={active ? solidColorStyle(cfg.color) : softColorStyle(cfg.color)}
                aria-pressed={active}
                onClick={() => {
                  setPage(1);
                  setStatuses((prev) =>
                    prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
                  );
                }}
              >
                {cfg.label}
              </button>
            );
          })}
          {statuses.length > 0 && (
            <button
              type="button"
              className="status-chip status-chip--clear"
              onClick={() => {
                setPage(1);
                setStatuses([]);
              }}
            >
              Скинути
            </button>
          )}
        </div>
      </div>
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
