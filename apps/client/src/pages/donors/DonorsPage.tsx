import { useState } from 'react';
import {
  CopyOutlined,
  EyeInvisibleOutlined,
  PlusOutlined,
  SearchOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { Button, Empty, Input, Modal, Space, Table, Tooltip, Typography, message } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { DonorResponse } from '@volunteerfleet/shared';
import { useDonorsList, useCreateDonor, useLinkDonor, useUnlinkDonor } from '../../hooks/useDonors';
import { donorsApi } from '../../api/donors.api';
import { useAuth } from '../../stores/auth.store';

export function DonorsPage() {
  const user = useAuth((s) => s.user);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newDonorName, setNewDonorName] = useState('');
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkDonorId, setLinkDonorId] = useState('');
  const [resolvedDonor, setResolvedDonor] = useState<{
    id: string;
    name: string;
    alreadyLinked: boolean;
  } | null>(null);
  const [resolving, setResolving] = useState(false);

  const { data, isLoading } = useDonorsList({ page, pageSize, isActive: true });
  const createDonor = useCreateDonor();
  const linkDonor = useLinkDonor();
  const unlinkDonor = useUnlinkDonor();

  const handleCreateDonor = async () => {
    if (!newDonorName.trim()) return;
    try {
      await createDonor.mutateAsync({ name: newDonorName.trim(), allowDuplicateName: false });
      message.success('Донора створено');
      setCreateModalOpen(false);
      setNewDonorName('');
    } catch {
      message.error('Не вдалося створити донора');
    }
  };

  const handleResolveDonor = async () => {
    if (!linkDonorId.trim()) return;
    setResolving(true);
    try {
      const result = await donorsApi.resolve(linkDonorId.trim());
      setResolvedDonor(result);
    } catch {
      message.error('Донора не знайдено');
      setResolvedDonor(null);
    } finally {
      setResolving(false);
    }
  };

  const handleLinkDonor = async () => {
    if (!resolvedDonor) return;
    try {
      if (!resolvedDonor.alreadyLinked) {
        await linkDonor.mutateAsync({ donorId: resolvedDonor.id });
        message.success('Донора додано');
      } else {
        message.info('Донор вже у вашому списку');
      }
      setLinkModalOpen(false);
      setLinkDonorId('');
      setResolvedDonor(null);
    } catch {
      message.error('Не вдалося додати донора');
    }
  };

  const handleUnlinkDonor = async (donorId: string) => {
    try {
      await unlinkDonor.mutateAsync(donorId);
      message.success('Донора приховано');
    } catch {
      message.error('Не вдалося приховати донора');
    }
  };

  const handleCopyUuid = (uuid: string) => {
    void navigator.clipboard.writeText(uuid);
    message.success('UUID скопійовано');
  };

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current ?? 1);
    setPageSize(pagination.pageSize ?? 20);
  };

  const columns: ColumnsType<DonorResponse> = [
    {
      title: "Ім'я",
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'UUID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <Space>
          <Typography.Text code copyable={{ text: id, tooltips: ['Копіювати', 'Скопійовано'] }}>
            {id.slice(0, 8)}...
          </Typography.Text>
          <Tooltip title="Копіювати UUID">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopyUuid(id)}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Дії',
      key: 'actions',
      width: 150,
      align: 'center',
      render: (_: unknown, row: DonorResponse) => (
        <Tooltip title="Приховати зі списку">
          <Button
            type="text"
            icon={<EyeInvisibleOutlined />}
            onClick={() => handleUnlinkDonor(row.id)}
            loading={unlinkDonor.isPending}
            aria-label="Приховати зі списку"
          />
        </Tooltip>
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
          Донори
        </Typography.Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Додати донора
          </Button>
          <Button icon={<UserAddOutlined />} onClick={() => setLinkModalOpen(true)}>
            Додати за ID
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data?.items ?? []}
        columns={columns}
        scroll={{ x: 600 }}
        onChange={handleTableChange}
        pagination={{
          current: page,
          pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showTotal: (total: number) => `Всього: ${total}`,
        }}
      />

      <Modal
        title="Додати донора"
        open={createModalOpen}
        onOk={handleCreateDonor}
        onCancel={() => {
          setCreateModalOpen(false);
          setNewDonorName('');
        }}
        okText="Додати"
        cancelText="Скасувати"
        confirmLoading={createDonor.isPending}
      >
        <Input
          placeholder="Ім'я донора"
          value={newDonorName}
          onChange={(e) => setNewDonorName(e.target.value)}
          onPressEnter={handleCreateDonor}
          autoFocus
        />
      </Modal>

      <Modal
        title="Додати донора за ID"
        open={linkModalOpen}
        onOk={resolvedDonor ? handleLinkDonor : handleResolveDonor}
        onCancel={() => {
          setLinkModalOpen(false);
          setLinkDonorId('');
          setResolvedDonor(null);
        }}
        okText={resolvedDonor ? (resolvedDonor.alreadyLinked ? 'Обрати' : 'Додати') : 'Знайти'}
        cancelText="Скасувати"
        confirmLoading={resolving || linkDonor.isPending}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Input
            placeholder="UUID донора"
            value={linkDonorId}
            onChange={(e) => {
              setLinkDonorId(e.target.value);
              setResolvedDonor(null);
            }}
            onPressEnter={resolvedDonor ? handleLinkDonor : handleResolveDonor}
            disabled={!!resolvedDonor}
            addonBefore={<SearchOutlined />}
            autoFocus
          />
          {resolvedDonor && (
            <div
              style={{
                padding: 12,
                background: '#f6ffed',
                border: '1px solid #b7eb8f',
                borderRadius: 6,
              }}
            >
              <Typography.Text strong>{resolvedDonor.name}</Typography.Text>
              {resolvedDonor.alreadyLinked && (
                <div>
                  <Typography.Text type="warning" style={{ fontSize: 12 }}>
                    Вже у вашому списку
                  </Typography.Text>
                </div>
              )}
            </div>
          )}
        </Space>
      </Modal>
    </Space>
  );
}
