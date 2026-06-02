import { useMemo, useState } from 'react';
import { CopyOutlined, DeleteOutlined, KeyOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import type { Role, UserResponse } from '@volunteerfleet/shared';
import { UserFormModal } from '../../modals/UserFormModal';
import { useDeleteUser, useResetPassword, useUpdateUser, useUsers } from '../../hooks/useUsers';

export function UsersPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [role, setRole] = useState<Role | undefined>();
  const [isActive, setIsActive] = useState<boolean | undefined>();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserResponse | undefined>();
  const [generatedPassword, setGeneratedPassword] = useState<string | undefined>();
  const { data, isFetching } = useUsers({
    page,
    pageSize,
    role,
    isActive,
    search: search || undefined,
  });
  const updateUser = useUpdateUser();
  const resetPassword = useResetPassword();
  const deleteUser = useDeleteUser();

  const columns = useMemo<ColumnsType<UserResponse>>(
    () => [
      { title: 'Email', dataIndex: 'email' },
      { title: 'ПІБ', dataIndex: 'fullName' },
      {
        title: 'Роль',
        dataIndex: 'role',
        render: (value: Role) => <Tag color={value === 'admin' ? 'red' : 'blue'}>{value}</Tag>,
      },
      {
        title: 'Активний',
        dataIndex: 'isActive',
        render: (value: boolean, user) => (
          <Switch
            checked={value}
            onChange={async (checked) => {
              await updateUser.mutateAsync({ id: user.id, payload: { isActive: checked } });
              message.success('Статус користувача оновлено');
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
        render: (_, user) => (
          <Space wrap>
            <Button
              size="small"
              onClick={() => {
                setEditingUser(user);
                setModalOpen(true);
              }}
            >
              Редагувати
            </Button>
            <Popconfirm
              title="Скинути пароль?"
              okText="Скинути"
              cancelText="Скасувати"
              onConfirm={async () => {
                const result = await resetPassword.mutateAsync(user.id);
                setGeneratedPassword(result.generatedPassword);
              }}
            >
              <Button size="small" icon={<KeyOutlined />}>
                Скинути пароль
              </Button>
            </Popconfirm>
            <Popconfirm
              title="Видалити користувача?"
              okText="Видалити"
              cancelText="Скасувати"
              onConfirm={async () => {
                await deleteUser.mutateAsync(user.id);
                message.success('Користувача видалено');
              }}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                Видалити
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [deleteUser, resetPassword, updateUser],
  );

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Користувачі
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingUser(undefined);
            setModalOpen(true);
          }}
        >
          Додати користувача
        </Button>
      </Space>
      <Space wrap>
        <Input.Search
          allowClear
          placeholder="Пошук за email або ПІБ"
          style={{ width: 320 }}
          onSearch={(value) => {
            setPage(1);
            setSearch(value.trim());
          }}
        />
        <Select
          allowClear
          placeholder="Роль"
          style={{ width: 200 }}
          value={role}
          onChange={(value) => {
            setPage(1);
            setRole(value);
          }}
          options={[
            { value: 'admin', label: 'Адміністратор' },
            { value: 'volunteer', label: 'Волонтер' },
            { value: 'guest', label: 'Гість' },
          ]}
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
      <UserFormModal
        open={modalOpen}
        user={editingUser}
        onClose={() => setModalOpen(false)}
        onGeneratedPassword={setGeneratedPassword}
      />
      <Modal
        title="Новий пароль"
        open={Boolean(generatedPassword)}
        onCancel={() => setGeneratedPassword(undefined)}
        footer={[
          <Button key="close" onClick={() => setGeneratedPassword(undefined)}>
            Закрити
          </Button>,
        ]}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>
            Передайте користувачеві безпечним каналом і пароль вже не буде показано.
          </Typography.Text>
          <Input.Group compact>
            <Input readOnly value={generatedPassword} style={{ width: 'calc(100% - 44px)' }} />
            <Button
              icon={<CopyOutlined />}
              onClick={async () => {
                await navigator.clipboard.writeText(generatedPassword ?? '');
                message.success('Пароль скопійовано');
              }}
            />
          </Input.Group>
        </Space>
      </Modal>
    </Space>
  );
}
