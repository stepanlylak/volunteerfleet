import { useState } from 'react';
import { PlusOutlined, UserAddOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Divider, Input, Modal, Select, Space, Typography, message } from 'antd';
import { useDonorsList, useCreateDonor, useLinkDonor } from '../hooks/useDonors';
import { donorsApi } from '../api/donors.api';

interface DonorPickerProps {
  value?: string;
  onChange?: (donorId: string) => void;
  disabled?: boolean;
}

export function DonorPicker({ value, onChange, disabled }: DonorPickerProps) {
  const [search, setSearch] = useState('');
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

  const { data, isLoading } = useDonorsList({ isActive: true, pageSize: 100 });
  const createDonor = useCreateDonor();
  const linkDonor = useLinkDonor();

  const handleCreateDonor = async () => {
    if (!newDonorName.trim()) return;
    try {
      const donor = await createDonor.mutateAsync({
        name: newDonorName.trim(),
        allowDuplicateName: false,
      });
      message.success('Донора створено');
      setCreateModalOpen(false);
      setNewDonorName('');
      onChange?.(donor.id);
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
        message.info('Донор вже у списку');
      }
      setLinkModalOpen(false);
      setLinkDonorId('');
      setResolvedDonor(null);
      onChange?.(resolvedDonor.id);
    } catch {
      message.error('Не вдалося додати донора');
    }
  };

  const filteredItems = search
    ? (data?.items.filter((d) => d.name.toLowerCase().includes(search.toLowerCase())) ?? [])
    : (data?.items ?? []);

  const dropdownRender = (menu: React.ReactNode) => (
    <>
      {menu}
      <Divider style={{ margin: '8px 0' }} />
      <Space direction="vertical" size="small" style={{ width: '100%', padding: '0 8px 8px' }}>
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalOpen(true)}
          style={{ width: '100%' }}
        >
          Створити нового донора
        </Button>
        <Button
          type="dashed"
          icon={<UserAddOutlined />}
          onClick={() => setLinkModalOpen(true)}
          style={{ width: '100%' }}
        >
          Додати за ID
        </Button>
      </Space>
    </>
  );

  return (
    <>
      <Select
        showSearch
        allowClear
        placeholder="Оберіть донора"
        value={value}
        onChange={onChange}
        onSearch={setSearch}
        disabled={disabled || isLoading}
        loading={isLoading}
        filterOption={false}
        optionLabelProp="label"
        dropdownRender={dropdownRender}
        style={{ width: '100%' }}
        options={filteredItems.map((d) => ({
          value: d.id,
          label: d.name,
        }))}
      />

      <Modal
        title="Створити нового донора"
        open={createModalOpen}
        onOk={handleCreateDonor}
        onCancel={() => {
          setCreateModalOpen(false);
          setNewDonorName('');
        }}
        okText="Створити"
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
        okText={
          resolvedDonor ? (resolvedDonor.alreadyLinked ? 'Обрати' : 'Додати та обрати') : 'Знайти'
        }
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
                    Вже у вашому списку — буде обрано
                  </Typography.Text>
                </div>
              )}
            </div>
          )}
        </Space>
      </Modal>
    </>
  );
}
