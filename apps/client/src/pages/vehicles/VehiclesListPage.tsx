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

type MonthGroupRow = { __type: 'monthGroup'; monthKey: string; label: string };
type TableRow = VehicleResponse | MonthGroupRow;

function isMonthGroup(row: TableRow): row is MonthGroupRow {
  return '__type' in row && row.__type === 'monthGroup';
}

const GROUP_COLS = 6; // total number of table columns

export function VehiclesListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<VehicleStatus[]>([]);
  const [hasAlerts, setHasAlerts] = useState<boolean | undefined>();
  const [sort, setSort] = useState('startDate:desc');
  const [groupByMonth, setGroupByMonth] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const orgRole = useOrgRole();
  const user = useAuth((s) => s.user);
  const canMutate = orgRole !== null && orgRole !== 'viewer';

  const { data, isFetching } = useVehicles({
    page: groupByMonth ? 1 : page,
    pageSize: groupByMonth ? 100 : pageSize,
    search: search || undefined,
    statuses: statuses.length > 0 ? statuses : undefined,
    hasAlerts,
    sort: groupByMonth ? 'startDate:desc' : sort,
  });

  // Build flat list with month-group header rows inserted between groups.
  const groupedRows = useMemo<TableRow[]>(() => {
    if (!groupByMonth) return data?.items ?? [];
    const items = data?.items ?? [];
    const result: TableRow[] = [];
    let lastMonthKey = '';
    for (const vehicle of items) {
      const monthKey = dayjs(vehicle.startDate).format('YYYY-MM');
      if (monthKey !== lastMonthKey) {
        lastMonthKey = monthKey;
        result.push({
          __type: 'monthGroup',
          monthKey,
          label: dayjs(vehicle.startDate).format('MMMM YYYY'),
        });
      }
      result.push(vehicle);
    }
    return result;
  }, [groupByMonth, data?.items]);

  const columns = useMemo<ColumnsType<TableRow>>(
    () => [
      {
        title: 'Обкладинка',
        key: 'cover',
        width: 100,
        render: (_, row) => {
          if (isMonthGroup(row)) {
            return {
              children: (
                <Typography.Text strong style={{ fontSize: 13, color: '#595959' }}>
                  {row.label}
                </Typography.Text>
              ),
              props: { colSpan: GROUP_COLS },
            };
          }
          const vehicle = row as VehicleResponse;
          return vehicle.mainGalleryCover ? (
            <Image
              width={80}
              height={60}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              src={vehiclesApi.getMainCoverUrl(
                vehicle.id,
                vehicle.mainGalleryCover.galleryId,
                vehicle.mainGalleryCover.itemId,
              )}
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
          );
        },
      },
      {
        title: 'Ідентифікатор',
        dataIndex: 'identifier',
        sorter: !groupByMonth,
        render: (value: string | undefined, row) =>
          isMonthGroup(row) ? { children: null, props: { colSpan: 0 } } : (value ?? ''),
      },
      {
        title: 'Марка і модель',
        key: 'model',
        sorter: !groupByMonth,
        render: (_, row) => {
          if (isMonthGroup(row)) return { children: null, props: { colSpan: 0 } };
          const vehicle = row as VehicleResponse;
          return (
            <Space direction="vertical" size={0}>
              <Typography.Text strong>
                {vehicle.brand} {vehicle.model}
              </Typography.Text>
              {vehicle.vin ? (
                <Typography.Text type="secondary">VIN: {vehicle.vin}</Typography.Text>
              ) : null}
            </Space>
          );
        },
      },
      {
        title: 'Рік',
        dataIndex: 'year',
        sorter: !groupByMonth,
        width: 100,
        render: (value: number | null | undefined, row) =>
          isMonthGroup(row) ? { children: null, props: { colSpan: 0 } } : (value ?? '—'),
      },
      {
        title: 'Статус',
        dataIndex: 'status',
        sorter: !groupByMonth,
        render: (_: VehicleStatus | undefined, row) => {
          if (isMonthGroup(row)) return { children: null, props: { colSpan: 0 } };
          const vehicle = row as VehicleResponse;
          return (
            <Space size="small">
              <VehicleStatusTag status={vehicle.status} />
              {vehicle.alerts.length > 0 && (
                <Tooltip title={vehicle.alerts.map((a) => a.message).join('; ')}>
                  <Badge count={vehicle.alerts.length} color="#faad14" />
                </Tooltip>
              )}
            </Space>
          );
        },
      },
      {
        title: 'Початкова дата',
        dataIndex: 'startDate',
        sorter: !groupByMonth,
        render: (value: string | undefined, row) =>
          isMonthGroup(row)
            ? { children: null, props: { colSpan: 0 } }
            : dayjs(value).format('DD.MM.YYYY'),
      },
    ],
    [groupByMonth],
  );

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _: Record<string, FilterValue | null>,
    sorter: SorterResult<TableRow> | SorterResult<TableRow>[],
  ) => {
    if (groupByMonth) return;
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
          <Space size="small">
            <Switch
              checked={groupByMonth}
              onChange={(checked) => {
                setGroupByMonth(checked);
                setPage(1);
              }}
            />
            <Typography.Text>По місяцях</Typography.Text>
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
      <Table<TableRow>
        rowKey={(row) => (isMonthGroup(row) ? `__month__${row.monthKey}` : row.id)}
        loading={isFetching}
        columns={columns}
        dataSource={groupedRows}
        pagination={
          groupByMonth
            ? false
            : {
                current: data?.page ?? page,
                pageSize: data?.pageSize ?? pageSize,
                total: data?.total ?? 0,
                showSizeChanger: true,
              }
        }
        onChange={handleTableChange}
        onRow={(row) => {
          if (isMonthGroup(row)) {
            return { style: { backgroundColor: '#fafafa', cursor: 'default' } };
          }
          return {
            onClick: () => navigate(`/vehicles/${(row as VehicleResponse).id}`),
            style: { cursor: 'pointer' },
          };
        }}
        rowClassName={(row) => (isMonthGroup(row) ? 'vehicle-month-group-row' : '')}
      />
      {canMutate && <VehicleFormModal open={modalOpen} onClose={() => setModalOpen(false)} />}
    </Space>
  );
}
