import { useMemo, useState } from 'react';
import { PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { Button, Input, Select, Space, Switch, Table, Typography, message } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import type { OrganizationResponse } from '@volunteerfleet/shared';
import { OrganizationFormModal } from '../../modals/OrganizationFormModal';
import { useOrganizations, useUpdateOrganization } from '../../hooks/useOrganizations';

export function OrganizationsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isActive, setIsActive] = useState<boolean | undefined>();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrganizationResponse | undefined>();

  const { data, isFetching } = useOrganizations({
    page,
    pageSize,
    isActive,
    search: search || undefined,
  });
  const updateOrg = useUpdateOrganization();

  const columns = useMemo<ColumnsType<OrganizationResponse>>(
    () => [
      { title: 'Назва', dataIndex: 'name' },
      { title: 'Опис', dataIndex: 'description' },
      {
        title: 'Активна',
        dataIndex: 'isActive',
        render: (value: boolean, org) => (
          <Switch
            checked={value}
            onChange={async (checked) => {
              await updateOrg.mutateAsync({ id: org.id, data: { isActive: checked } });
              message.success('Статус оновлено');
            }}
          />
        ),
      },
      {
        title: 'Створено',
        dataIndex: 'createdAt',
        render: (value: string) => dayjs(value).format('DD.MM.YYYY HH:mm'),
      },
      {
        title: 'Дії',
        key: 'actions',
        render: (_, org) => (
          <Space wrap>
            <Button
              size="small"
              onClick={() => {
                setEditingOrg(org);
                setModalOpen(true);
              }}
            >
              Редагувати
            </Button>
            <Link to={`/admin/organizations/${org.id}/members`}>
              <Button size="small" icon={<TeamOutlined />}>
                Учасники
              </Button>
            </Link>
          </Space>
        ),
      },
    ],
    [updateOrg],
  );

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Організації
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingOrg(undefined);
            setModalOpen(true);
          }}
        >
          Додати організацію
        </Button>
      </Space>
      <Space wrap>
        <Input.Search
          allowClear
          placeholder="Пошук за назвою"
          style={{ width: 320 }}
          onSearch={(value) => {
            setPage(1);
            setSearch(value.trim());
          }}
        />
        <Select
          allowClear
          placeholder="Активність"
          style={{ width: 180 }}
          value={isActive}
          onChange={(value) => {
            setPage(1);
            setIsActive(value);
          }}
          options={[
            { value: true, label: 'Активні' },
            { value: false, label: 'Неактивні' },
          ]}
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
        onChange={(pagination: TablePaginationConfig) => {
          setPage(pagination.current ?? 1);
          setPageSize(pagination.pageSize ?? 20);
        }}
      />
      <OrganizationFormModal
        open={modalOpen}
        organization={editingOrg}
        onClose={() => setModalOpen(false)}
      />
    </Space>
  );
}
