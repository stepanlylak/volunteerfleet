import { useMemo, useState } from 'react';
import { DeleteOutlined, EditOutlined, UserAddOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { ORG_ROLES } from '@volunteerfleet/shared';
import type {
  OrgRole,
  OrganizationMemberResponse,
  OrganizationUpdate,
} from '@volunteerfleet/shared';
import {
  useAddMyOrganizationMember,
  useMyOrganization,
  useRemoveMyOrganizationMember,
  useUpdateMyOrganization,
  useUpdateMyOrganizationMemberRole,
} from '../../hooks/useMyOrganization';
import { useAuth, useOrgRole } from '../../stores/auth.store';
import { Navigate } from 'react-router-dom';

type MemberWithUser = OrganizationMemberResponse & {
  user: { id: string; email: string; fullName: string };
};

export function MyOrganizationPage() {
  const user = useAuth((s) => s.user);
  const orgRole = useOrgRole();
  const isCoordinator = orgRole === 'coordinator';

  const [editOrgModalOpen, setEditOrgModalOpen] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);

  const [orgForm] = Form.useForm<OrganizationUpdate>();
  const [memberForm] = Form.useForm<{ email: string; role: OrgRole }>();

  const { data: org, isFetching: isFetchingOrg } = useMyOrganization();
  const updateOrg = useUpdateMyOrganization();
  const addMember = useAddMyOrganizationMember();
  const updateRole = useUpdateMyOrganizationMemberRole();
  const removeMember = useRemoveMyOrganizationMember();

  if (!user || !user.activeOrgId) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!isCoordinator) {
    return <Navigate to="/403" replace />;
  }

  const handleUpdateOrg = async (values: OrganizationUpdate) => {
    try {
      await updateOrg.mutateAsync(values);
      message.success('Організацію оновлено');
      setEditOrgModalOpen(false);
    } catch {
      message.error('Не вдалося оновити організацію');
    }
  };

  const handleAddMember = async (values: { email: string; role: OrgRole }) => {
    try {
      await addMember.mutateAsync(values);
      message.success('Учасника додано');
      setAddMemberModalOpen(false);
      memberForm.resetFields();
    } catch {
      message.error(
        'Не вдалося додати учасника. Можливо, він вже є в цій організації або email не знайдено.',
      );
    }
  };

  const openEditOrgModal = () => {
    if (org) {
      orgForm.setFieldsValue({
        name: org.name,
        description: org.description,
      });
      setEditOrgModalOpen(true);
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
                await updateRole.mutateAsync({ userId: record.userId, data: { role: newRole } });
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
                await removeMember.mutateAsync(record.userId);
                message.success('Учасника видалено');
              } catch {
                message.error('Не вдалося видалити учасника');
              }
            }}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={record.userId === user?.id}
            >
              Видалити
            </Button>
          </Popconfirm>
        ),
      },
    ],
    [removeMember, updateRole, user?.id],
  );

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Налаштування організації
        </Typography.Title>
      </Space>

      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card
            title="Інформація про організацію"
            extra={
              <Button icon={<EditOutlined />} onClick={openEditOrgModal}>
                Редагувати
              </Button>
            }
            loading={isFetchingOrg}
          >
            {org && (
              <Descriptions column={1}>
                <Descriptions.Item label="Назва">{org.name}</Descriptions.Item>
                <Descriptions.Item label="Опис">{org.description || '—'}</Descriptions.Item>
                <Descriptions.Item label="Статус">
                  {org.isActive ? 'Активна' : 'Неактивна'}
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card
            title="Учасники"
            extra={
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                onClick={() => setAddMemberModalOpen(true)}
              >
                Додати учасника
              </Button>
            }
          >
            <Table
              rowKey="id"
              loading={isFetchingOrg}
              columns={columns}
              dataSource={(org?.members as MemberWithUser[]) ?? []}
              pagination={false}
            />
          </Card>
        </Col>
      </Row>

      {/* Edit Organization Modal */}
      <Modal
        title="Редагувати організацію"
        open={editOrgModalOpen}
        onCancel={() => setEditOrgModalOpen(false)}
        onOk={() => orgForm.submit()}
        confirmLoading={updateOrg.isPending}
      >
        <Form form={orgForm} layout="vertical" onFinish={handleUpdateOrg}>
          <Form.Item
            name="name"
            label="Назва"
            rules={[{ required: true, message: 'Введіть назву організації' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Опис">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        title="Додати учасника"
        open={addMemberModalOpen}
        onCancel={() => setAddMemberModalOpen(false)}
        onOk={() => memberForm.submit()}
        confirmLoading={addMember.isPending}
      >
        <Form form={memberForm} layout="vertical" onFinish={handleAddMember}>
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
