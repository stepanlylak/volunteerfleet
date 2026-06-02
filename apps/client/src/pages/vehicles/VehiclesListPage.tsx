import { useMemo, useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { Button, Input, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import type { VehicleResponse } from '@volunteerfleet/shared';
import { VehicleFormModal } from '../../modals/VehicleFormModal';
import { useDictionaries } from '../../hooks/useDictionaries';
import { useVehicles } from '../../hooks/useVehicles';

export function VehiclesListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusId, setStatusId] = useState<string | undefined>();
  const [sort, setSort] = useState('createdAt:desc');
  const [modalOpen, setModalOpen] = useState(false);
  const { data: dictionaries } = useDictionaries();
  const { data, isFetching } = useVehicles({
    page,
    pageSize,
    search: search || undefined,
    statusId,
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
        dataIndex: ['status', 'name'],
        render: (_: string, vehicle) => (
          <Tag color={vehicle.status?.color ?? 'blue'}>{vehicle.status?.name ?? '—'}</Tag>
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

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Автомобілі
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Додати авто
        </Button>
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
          value={statusId}
          onChange={(value) => {
            setPage(1);
            setStatusId(value);
          }}
          options={(dictionaries?.vehicleStatuses ?? []).map((status) => ({
            value: status.id,
            label: status.name,
          }))}
        />
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
      <VehicleFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </Space>
  );
}
