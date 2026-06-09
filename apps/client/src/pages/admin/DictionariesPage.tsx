import { useState } from 'react';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Popconfirm, Space, Table, Tabs, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AxiosError } from 'axios';
import type { DictionaryType } from '../../api/dictionaries.api';
import { DictionaryItemModal } from '../../modals/DictionaryItemModal';
import {
  type DictionaryItem,
  useDeleteDictionaryItem,
  useDictionary,
} from '../../hooks/useDictionaries';

interface ErrorBody {
  message?: string;
}

function conflictMessage(error: unknown) {
  const axiosError = error as AxiosError<ErrorBody>;
  return axiosError.response?.data?.message ?? 'Елемент використовується і не може бути видалений';
}

function DictionaryTable({ type }: { type: DictionaryType }) {
  const { data, isFetching } = useDictionary(type);
  const deleteItem = useDeleteDictionaryItem(type);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DictionaryItem | undefined>();

  const columns: ColumnsType<DictionaryItem> = [
    { title: 'Назва', dataIndex: 'name' },
    { title: 'Порядок', dataIndex: 'sortOrder', width: 120 },
    {
      title: 'Дії',
      key: 'actions',
      width: 220,
      render: (_, item) => (
        <Space wrap>
          <Button
            size="small"
            onClick={() => {
              setEditingItem(item);
              setModalOpen(true);
            }}
          >
            Редагувати
          </Button>
          <Popconfirm
            title="Видалити елемент?"
            okText="Видалити"
            cancelText="Скасувати"
            onConfirm={async () => {
              try {
                await deleteItem.mutateAsync(item.id);
                message.success('Елемент видалено');
              } catch (error) {
                message.warning(conflictMessage(error));
              }
            }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Видалити
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => {
          setEditingItem(undefined);
          setModalOpen(true);
        }}
      >
        Додати
      </Button>
      <Table rowKey="id" loading={isFetching} columns={columns} dataSource={data ?? []} />
      <DictionaryItemModal
        open={modalOpen}
        type={type}
        item={editingItem}
        onClose={() => setModalOpen(false)}
      />
    </Space>
  );
}

export function DictionariesPage() {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={2} style={{ margin: 0 }}>
        Довідники
      </Typography.Title>
      <Tabs
        items={[
          {
            key: 'financial-categories',
            label: 'Фінансові категорії',
            children: <DictionaryTable type="financial-categories" />,
          },
        ]}
      />
      <Alert
        message="Як це працює?"
        description="Фінансові категорії використовуються для витрат і донатів. Порядок сортування визначає послідовність елементів у випадаючих списках."
        type="info"
        showIcon
      />
    </Space>
  );
}
