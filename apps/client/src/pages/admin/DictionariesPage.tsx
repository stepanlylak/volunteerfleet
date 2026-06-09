import { useState } from 'react';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Tabs,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AxiosError } from 'axios';
import type { DictionaryType } from '../../api/dictionaries.api';
import { DictionaryItemModal } from '../../modals/DictionaryItemModal';
import {
  type DictionaryItem,
  useDeleteDictionaryItem,
  useDictionary,
  useUpdateDictionaryItem,
} from '../../hooks/useDictionaries';


const KIND_COLORS: Record<string, string> = {
  in_work: 'processing',
  final: 'success',
  other: 'default',
};

interface ErrorBody {
  message?: string;
}

function conflictMessage(error: unknown) {
  const axiosError = error as AxiosError<ErrorBody>;
  return axiosError.response?.data?.message ?? 'Елемент використовується і не може бути видалений';
}

function DictionaryTable({ type }: { type: DictionaryType }) {
  const { data, isFetching } = useDictionary(type);
  const updateItem = useUpdateDictionaryItem(type);
  const deleteItem = useDeleteDictionaryItem(type);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DictionaryItem | undefined>();

  const columns: ColumnsType<DictionaryItem> = [
    { title: 'Назва', dataIndex: 'name' },
    ...(type !== 'funding-sources'
      ? [{ title: 'Порядок', dataIndex: 'sortOrder', width: 120 }]
      : []),
    ...(type === 'vehicle-statuses'
      ? [
          {
            title: 'За замовчуванням',
            dataIndex: 'isDefault',
            width: 180,
            render: (value: boolean, item: DictionaryItem) => (
              <Switch
                checked={value}
                onChange={async (checked) => {
                  if (checked) {
                    const currentDefault = (data ?? []).find(
                      (candidate) =>
                        'isDefault' in candidate && candidate.isDefault && candidate.id !== item.id,
                    );
                    if (currentDefault) {
                      await updateItem.mutateAsync({
                        id: currentDefault.id,
                        payload: { isDefault: false },
                      });
                    }
                  }
                  await updateItem.mutateAsync({ id: item.id, payload: { isDefault: checked } });
                  message.success('Статус за замовчуванням оновлено');
                }}
              />
            ),
          },
          {
            title: 'Тип',
            dataIndex: 'kind',
            width: 120,
            render: (kind: string) => (
              <Tag color={KIND_COLORS[kind] ?? 'default'}>{KIND_LABELS[kind] ?? kind}</Tag>
            ),
          },
          {
            title: 'Колір',
            dataIndex: 'color',
            width: 120,
            render: (_: unknown, item: DictionaryItem) => {
              const color = (item as VehicleStatus).color ?? '#8c8c8c';
              return (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 3,
                      background: color,
                      border: '1px solid #d9d9d9',
                      display: 'inline-block',
                    }}
                  />
                  {color}
                </span>
              );
            },
          },
        ]
      : []),
    ...(type === 'funding-sources'
      ? [
          { title: 'Тип', dataIndex: 'type', width: 160 },
          { title: 'Опис', dataIndex: 'description' },
        ]
      : []),
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
            key: 'vehicle-statuses',
            label: 'Статуси авто',
            children: <DictionaryTable type="vehicle-statuses" />,
          },
          {
            key: 'expense-categories',
            label: 'Категорії витрат',
            children: <DictionaryTable type="expense-categories" />,
          },
          {
            key: 'funding-sources',
            label: 'Джерела фінансування',
            children: <DictionaryTable type="funding-sources" />,
          },
        ]}
      />
      <Alert
        message="Як це працює?"
        description="Значення з цих списків використовуються при додаванні транспортних засобів та обліку витрат. Статус або категорія з відміткою «За замовчуванням» автоматично підставляється у нові форми. Порядок сортування визначає послідовність елементів у випадаючих списках."
        type="info"
        showIcon
      />
    </Space>
  );
}
