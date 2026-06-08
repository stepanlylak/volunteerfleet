import { useMemo, useState } from 'react';
import { ArrowLeftOutlined, DeleteOutlined, UserAddOutlined } from '@ant-design/icons';
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { Link, useParams } from 'react-router-dom';
import { ORG_ROLES } from '@volunteerfleet/shared';
import type { OrgRole, OrganizationMemberResponse } from '@volunteerfleet/shared';
import {
  useAddOrganizationMember,
  useOrganization,
  useRemoveOrganizationMember,
  useUpdateOrganizationMemberRole,
} from '../../hooks/useOrganizations';

// The member response extended with user object based on OrganizationWithMembersResponse
type MemberWithUser = OrganizationMemberResponse & {
  user: { id: string; email: string; fullName: string };
};

export function OrganizationMembersPage() {
  const { id } = useParams<{ id: string }>();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<{ email: string; role: OrgRole }>();

  const { data: org, isFetching } = useOrganization(id!);
  const addMember = useAddOrganizationMember();
  const updateRole = useUpdateOrganizationMemberRole();
  const removeMember = useRemoveOrganizationMember();

  const handleAddMember = async (values: { email: string; role: OrgRole }) => {
    try {
      await addMember.mutateAsync({ id: id!, data: values });
      message.success('Учасника додано');
      setModalOpen(false);
      form.resetFields();
    } catch {
      message.error(
        'Не вдалося додати учасника. Можливо, він вже є в цій організації або email не знайдено.',
      );
    }
  };

  const columns = useMemo<ColumnsType<MemberWithUser>>(
    () => [
      { title: 'Email', dataIndex: ['user', 'email'] },
      { title: 'ПІБ', dataIndex: ['user', 'fullName'] },
      {
        title: 'Роль в організації',
        dataIndex: 'role',
        render: (value: OrgRole, record) => (
          <Select
            value={value}
            onChange={async (newRole) => {
              try {
                await updateRole.mutateAsync({
                  id: id!,
                  userId: record.userId,
                  data: { role: newRole },
                });
                message.success('Роль оновлено');
              } catch {
                message.error('Не вдалося оновити роль');
              }
            }}
            options={ORG_ROLES.map((r) => ({ value: r, label: r }))}
            style={{ width: 140 }}
          />
        ),
      },
      {
        title: 'Додано',
        dataIndex: 'createdAt',
        render: (value: string) => dayjs(value).format('DD.MM.YYYY HH:mm'),
      },
      {
        title: 'Дії',
        key: 'actions',
        render: (_, record) => (
          <Popconfirm
            title="Видалити учасника?"
            okText="Видалити"
            cancelText="Скасувати"
            onConfirm={async () => {
              try {
                await removeMember.mutateAsync({ id: id!, userId: record.userId });
                message.success('Учасника видалено');
              } catch {
                message.error('Не вдалося видалити учасника');
              }
            }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Видалити
            </Button>
          </Popconfirm>
        ),
      },
    ],
    [id, removeMember, updateRole],
  );

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
        <Space>
          <Link to="/admin/organizations">
            <Button icon={<ArrowLeftOutlined />} type="text" />
          </Link>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Учасники: {org?.name ?? '...'}
          </Typography.Title>
        </Space>
        <Button type="primary" icon={<UserAddOutlined />} onClick={() => setModalOpen(true)}>
          Додати учасника
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={isFetching}
        columns={columns}
        dataSource={(org?.members as MemberWithUser[]) ?? []}
        pagination={false}
      />

      <Modal
        title="Додати учасника"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={addMember.isPending}
      >
        <Form form={form} layout="vertical" onFinish={handleAddMember}>
          <Form.Item
            name="email"
            label="Email користувача"
            rules={[
              { required: true, message: 'Введіть email' },
              { type: 'email', message: 'Некоректний email' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="role"
            label="Роль"
            initialValue="viewer"
            rules={[{ required: true, message: 'Оберіть роль' }]}
          >
            <Select options={ORG_ROLES.map((r) => ({ value: r, label: r }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
