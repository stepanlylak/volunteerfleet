import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  LeftOutlined,
  LinkOutlined,
  PaperClipOutlined,
  PictureOutlined,
  PlusOutlined,
  RightOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import {
  Button,
  Col,
  Divider,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQueries } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import type { Currency, DocumentResponse, ExpenseResponse } from '@volunteerfleet/shared';
import { vehicleUpdateSchema } from '@volunteerfleet/shared';
import { DocumentFormModal } from '../../modals/DocumentFormModal';
import { ExpenseFormModal } from '../../modals/ExpenseFormModal';
import { VehicleFormModal } from '../../modals/VehicleFormModal';
import {
  useDeleteVehicle,
  useRestoreVehicle,
  useUpdateVehicle,
  useVehicle,
  useVehiclePhotos,
  useVehicleStatusHistory,
} from '../../hooks/useVehicles';
import {
  useDeleteDocument,
  useUpdateDocument,
  useVehicleDocuments,
} from '../../hooks/useDocuments';
import { useDeleteExpense, useVehicleExpenses } from '../../hooks/useExpenses';
import { useDictionaries } from '../../hooks/useDictionaries';
import { useAuth } from '../../stores/auth.store';
import { documentsApi } from '../../api/documents.api';
import { exchangeRatesApi } from '../../api/exchange-rates.api';
import { vehiclesApi } from '../../api/vehicles.api';
import { confirmDocumentDetachAction } from '../../utils/documentDetachConfirm';
import { formatCurrency, formatDate } from '../../utils/format';

interface PublicFormValues {
  isPublic: boolean;
  publicSummary?: string | null;
  publicCollectedAmountUah?: number | null;
  publicGoalAmountUah?: number | null;
}

type DocumentPurpose = 'general' | 'expense';

const DOCUMENT_PURPOSE_OPTIONS: { label: string; value: DocumentPurpose }[] = [
  { label: 'Загальні', value: 'general' },
  { label: 'Витрати', value: 'expense' },
];

const CURRENCY_ORDER: Currency[] = ['UAH', 'USD', 'EUR'];

function renderDescription(value: string | null) {
  const text = value?.trim() || '—';
  return (
    <span
      title={value?.trim() || undefined}
      style={{
        display: 'block',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
}

function confirmAction({
  title,
  content,
  okText,
}: {
  title: string;
  content: string;
  okText: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title,
      content,
      okText,
      cancelText: 'Скасувати',
      okButtonProps: { danger: true },
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

export function VehicleCardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm<PublicFormValues>();
  const role = useAuth((state) => state.user?.userRole);
  // TODO(ORG-17): gate by orgRole once the active-org context lands on the client (ORG-14).
  const isAdmin = role === 'superuser';
  const { data: vehicle, isLoading } = useVehicle(id, isAdmin);
  const { data: history } = useVehicleStatusHistory(id);
  const updateVehicle = useUpdateVehicle();
  const deleteVehicle = useDeleteVehicle();
  const restoreVehicle = useRestoreVehicle();
  const [editOpen, setEditOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseResponse | undefined>();
  const [docOpen, setDocOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<DocumentResponse | undefined>();
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [activeTab, setActiveTab] = useState('expenses');
  const [documentPurposeFilter, setDocumentPurposeFilter] = useState<DocumentPurpose[]>([
    'general',
    'expense',
  ]);
  const [documentExpenseIdFilter, setDocumentExpenseIdFilter] = useState<string | null>(null);
  const [statusEditing, setStatusEditing] = useState(false);
  const { data: dictionaries } = useDictionaries();

  const { data: expensesData, isLoading: expensesLoading } = useVehicleExpenses(id);
  const deleteExpense = useDeleteExpense(id);
  const { data: documentsData, isLoading: docsLoading } = useVehicleDocuments(id, {
    pageSize: 100,
  });
  const deleteDocument = useDeleteDocument(id);
  const updateDocument = useUpdateDocument(id);
  const { data: photosData, isLoading: photosLoading } = useVehiclePhotos(id);

  const expenses = expensesData?.items ?? [];
  const documents = documentsData?.items ?? [];
  const photos = photosData?.items ?? [];
  const documentCountByExpense = documents.reduce((map, doc) => {
    if (!doc.expenseId) return map;
    map.set(doc.expenseId, (map.get(doc.expenseId) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  const filteredDocuments = documents.filter((doc) => {
    const purpose: DocumentPurpose = doc.expenseId ? 'expense' : 'general';
    if (!documentPurposeFilter.includes(purpose)) return false;
    if (documentExpenseIdFilter && doc.expenseId !== documentExpenseIdFilter) return false;
    return true;
  });
  const missingRateRequests = useMemo(
    () =>
      expenses
        .filter((expense) => expense.currency !== 'UAH' && expense.rate <= 1)
        .map((expense) => ({
          id: expense.id,
          expenseDate: expense.expenseDate,
          currency: expense.currency,
        })),
    [expenses],
  );
  const missingRateResults = useQueries({
    queries: missingRateRequests.map((request) => ({
      queryKey: ['exchange-rate', request.expenseDate, request.currency],
      queryFn: () => exchangeRatesApi.getRate(request.expenseDate, request.currency),
      staleTime: 10 * 60_000,
    })),
  });
  const fallbackRateByExpenseId = useMemo(() => {
    const rates = new Map<string, number>();
    for (const [index, request] of missingRateRequests.entries()) {
      const rate = missingRateResults[index]?.data?.rate;
      if (rate !== undefined) rates.set(request.id, rate);
    }
    return rates;
  }, [missingRateRequests, missingRateResults]);
  const getExpenseRate = (expense: ExpenseResponse) => {
    if (expense.currency === 'UAH') return 1;
    if (expense.rate > 1) return expense.rate;
    return fallbackRateByExpenseId.get(expense.id) ?? expense.rate;
  };
  const totalUah = expenses.reduce((sum, e) => sum + e.amount * getExpenseRate(e), 0);
  const totalsByCurrency = useMemo(
    () =>
      Array.from(
        expenses.reduce((map, expense) => {
          map.set(expense.currency, (map.get(expense.currency) ?? 0) + expense.amount);
          return map;
        }, new Map<Currency, number>()),
      ).sort(
        ([currencyA], [currencyB]) =>
          CURRENCY_ORDER.indexOf(currencyA) - CURRENCY_ORDER.indexOf(currencyB),
      ),
    [expenses],
  );
  const hasCompletePublicPage =
    vehicle?.isPublic &&
    Boolean(vehicle.publicSummary?.trim()) &&
    vehicle.publicCollectedAmountUah !== null &&
    vehicle.publicGoalAmountUah !== null;
  const publicVehicleUrl = vehicle?.isPublic ? `/public/vehicles/${vehicle.id}` : null;

  useEffect(() => {
    if (!vehicle) return;
    form.setFieldsValue({
      isPublic: vehicle.isPublic,
      publicSummary: vehicle.publicSummary,
      publicCollectedAmountUah: vehicle.publicCollectedAmountUah,
      publicGoalAmountUah: vehicle.publicGoalAmountUah,
    });
    setDescriptionDraft(vehicle.description ?? '');
  }, [form, vehicle]);

  if (isLoading) return <Skeleton active />;
  if (!vehicle) return <Empty description="Авто не знайдено" />;

  const handlePublicSave = async (values: PublicFormValues) => {
    const payload = {
      ...values,
      publicSummary: values.publicSummary?.trim() ? values.publicSummary.trim() : null,
      publicCollectedAmountUah: values.publicCollectedAmountUah ?? null,
      publicGoalAmountUah: values.publicGoalAmountUah ?? null,
    };
    const parsed = vehicleUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      message.error('Перевірте публічні поля');
      return;
    }
    await updateVehicle.mutateAsync({ id: vehicle.id, payload: parsed.data });
    message.success('Публічні поля оновлено');
  };

  const savedDescription = vehicle.description ?? '';
  const descriptionChanged = descriptionDraft !== savedDescription;

  const handleDescriptionSave = async () => {
    const normalizedDescription = descriptionDraft.trim();
    const payload = {
      description: normalizedDescription ? normalizedDescription : null,
    };
    const parsed = vehicleUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      message.error('Перевірте текст нотаток');
      return;
    }

    await updateVehicle.mutateAsync({ id: vehicle.id, payload: parsed.data });
    message.success('Нотатки оновлено');
  };

  const handleDeleteExpense = async (expense: ExpenseResponse) => {
    const attachedDocuments = documents.filter((doc) => doc.expenseId === expense.id);
    let detachAction: 'delete' | 'unlink' | null = null;

    if (attachedDocuments.length > 0) {
      detachAction = await confirmDocumentDetachAction({
        count: attachedDocuments.length,
        title: 'Видалити витрату з документами?',
        description:
          'До цієї витрати привʼязані документи. Оберіть, видалити їх повністю чи лише відвʼязати від витрати.',
      });
      if (!detachAction) return;
    } else {
      const confirmed = await confirmAction({
        title: 'Видалити витрату?',
        content: 'Цю дію можна буде скасувати тільки через відновлення видалених записів.',
        okText: 'Видалити',
      });
      if (!confirmed) return;
    }

    if (detachAction === 'delete') {
      for (const document of attachedDocuments) {
        await deleteDocument.mutateAsync(document.id);
      }
    } else if (detachAction === 'unlink') {
      for (const document of attachedDocuments) {
        await updateDocument.mutateAsync({
          id: document.id,
          payload: { expenseId: null, vehicleId: vehicle.id },
        });
      }
    }

    await deleteExpense.mutateAsync(expense.id);
    void message.success('Витрату видалено');
  };

  const headerActions = (
    <Space wrap>
      <Button
        icon={<FileTextOutlined />}
        onClick={() => window.open(`/reports/vehicle/${vehicle.id}`, '_blank', 'noopener')}
      >
        Звіт по авто
      </Button>
      <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
        Редагувати
      </Button>
      {isAdmin && !vehicle.deletedAt ? (
        <Popconfirm
          title="Видалити авто?"
          okText="Видалити"
          cancelText="Скасувати"
          onConfirm={async () => {
            await deleteVehicle.mutateAsync(vehicle.id);
            message.success('Авто видалено');
            navigate('/vehicles');
          }}
        >
          <Button danger icon={<DeleteOutlined />}>
            Видалити
          </Button>
        </Popconfirm>
      ) : null}
      {isAdmin && vehicle.deletedAt ? (
        <Button
          icon={<RollbackOutlined />}
          onClick={async () => {
            await restoreVehicle.mutateAsync(vehicle.id);
            message.success('Авто відновлено');
          }}
        >
          Restore
        </Button>
      ) : null}
    </Space>
  );

  const statusTag =
    isAdmin && !vehicle.deletedAt && statusEditing ? (
      <Select
        size="small"
        autoFocus
        defaultOpen
        style={{ minWidth: 160 }}
        value={vehicle.statusId}
        loading={updateVehicle.isPending}
        options={(dictionaries?.vehicleStatuses ?? []).map((s) => ({
          value: s.id,
          label: s.name,
        }))}
        onBlur={() => setStatusEditing(false)}
        onChange={async (statusId) => {
          setStatusEditing(false);
          if (statusId === vehicle.statusId) return;
          await updateVehicle.mutateAsync({ id: vehicle.id, payload: { statusId } });
          message.success('Статус оновлено');
        }}
      />
    ) : (
      <Tag
        color={vehicle.deletedAt ? 'red' : (vehicle.status?.color ?? 'blue')}
        style={isAdmin && !vehicle.deletedAt ? { cursor: 'pointer' } : undefined}
        onClick={() => {
          if (isAdmin && !vehicle.deletedAt) setStatusEditing(true);
        }}
      >
        {vehicle.status?.name ?? '—'}
        {isAdmin && !vehicle.deletedAt ? <EditOutlined style={{ marginLeft: 6 }} /> : null}
      </Tag>
    );

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Text type="secondary" style={{ fontSize: 14 }}>
          Авто / {vehicle.brand} {vehicle.model} ({vehicle.identifier})
        </Typography.Text>
        {headerActions}
      </Space>

      <Row gutter={[24, 24]} align="top">
        <Col xs={24} lg={8}>
          <VehiclePhotoGallery photos={photos} vehicleId={vehicle.id} loading={photosLoading} />
        </Col>
        <Col xs={24} lg={16}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space wrap size="small">
              <Tag style={{ fontSize: 13, padding: '2px 10px', borderRadius: 12 }}>
                ID: {vehicle.identifier}
              </Tag>
              {statusTag}
            </Space>
            <Typography.Title level={2} style={{ margin: 0 }}>
              {vehicle.brand} {vehicle.model}
            </Typography.Title>
            <Space wrap split={<Typography.Text type="secondary">•</Typography.Text>}>
              <Space size="small">
                <Typography.Text type="secondary">Держ. номер:</Typography.Text>
                <Typography.Text strong>{vehicle.identifier}</Typography.Text>
              </Space>
              <Space size="small">
                <Typography.Text type="secondary">Додав:</Typography.Text>
                <Typography.Text strong>{vehicle.createdBy.fullName}</Typography.Text>
              </Space>
            </Space>
            <Divider style={{ margin: '8px 0' }} />
            <Row gutter={[24, 16]}>
              <Col xs={24} sm={12}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  VIN КОД
                </Typography.Text>
                <div>
                  <Typography.Text strong>{vehicle.vin ?? '—'}</Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  РІК ВИПУСКУ
                </Typography.Text>
                <div>
                  <Typography.Text strong>{vehicle.year ?? '—'}</Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  ДАТА ПЕРЕТИНУ КОРДОНУ
                </Typography.Text>
                <div>
                  <Typography.Text strong>
                    {vehicle.borderCrossingDate ? formatDate(vehicle.borderCrossingDate) : '—'}
                  </Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  ДОДАНО
                </Typography.Text>
                <div>
                  <Typography.Text strong>
                    {dayjs(vehicle.createdAt).format('DD.MM.YYYY HH:mm')}
                  </Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  ОНОВЛЕНО
                </Typography.Text>
                <div>
                  <Typography.Text strong>
                    {dayjs(vehicle.updatedAt).format('DD.MM.YYYY HH:mm')}
                  </Typography.Text>
                </div>
              </Col>
              <Col xs={24}>
                <Space
                  align="center"
                  style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}
                >
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    ОПИС
                  </Typography.Text>
                  <Button
                    size="small"
                    type="primary"
                    disabled={!descriptionChanged || Boolean(vehicle.deletedAt)}
                    loading={updateVehicle.isPending}
                    onClick={() => void handleDescriptionSave()}
                  >
                    Зберегти
                  </Button>
                </Space>
                <Input.TextArea
                  rows={4}
                  maxLength={2000}
                  showCount
                  placeholder="Додайте важливу інформацію про авто"
                  value={descriptionDraft}
                  disabled={Boolean(vehicle.deletedAt)}
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                />
              </Col>
            </Row>
          </Space>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'expenses',
            label: 'Витрати',
            children: (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Space
                  align="start"
                  style={{ justifyContent: 'space-between', width: '100%' }}
                  wrap
                >
                  <Space direction="vertical" size={4}>
                    <Statistic title="Разом (UAH)" value={totalUah} precision={2} suffix="₴" />
                    {totalsByCurrency.length > 0 ? (
                      <Space wrap size={[8, 8]}>
                        <Typography.Text type="secondary">За валютами:</Typography.Text>
                        {totalsByCurrency.map(([currency, total]) => (
                          <Tag key={currency}>{formatCurrency(total, currency)}</Tag>
                        ))}
                      </Space>
                    ) : null}
                  </Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setEditingExpense(undefined);
                      setExpenseOpen(true);
                    }}
                  >
                    Додати витрату
                  </Button>
                </Space>
                <Table<ExpenseResponse>
                  dataSource={expenses}
                  loading={expensesLoading}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  locale={{ emptyText: 'Витрат ще немає' }}
                  columns={
                    [
                      {
                        title: 'Дата',
                        dataIndex: 'expenseDate',
                        render: (v: string) => formatDate(v),
                        width: 110,
                      },
                      {
                        title: 'Сума',
                        key: 'amount',
                        render: (_, r) => (
                          <Space direction="vertical" size={0}>
                            <span>{formatCurrency(r.amount, r.currency)}</span>
                            {r.currency !== 'UAH' && (
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                ≈ {formatCurrency(r.amount * getExpenseRate(r), 'UAH')}
                              </Typography.Text>
                            )}
                          </Space>
                        ),
                      },
                      {
                        title: 'Категорія',
                        dataIndex: ['category', 'name'],
                      },
                      {
                        title: 'Джерело',
                        dataIndex: ['fundingSource', 'name'],
                      },
                      {
                        title: 'Опис',
                        dataIndex: 'description',
                        width: 240,
                        ellipsis: true,
                        render: renderDescription,
                      },
                      {
                        title: 'Ким',
                        dataIndex: ['createdBy', 'fullName'],
                      },
                      {
                        title: 'Документи',
                        key: 'documents',
                        width: 120,
                        render: (_, r) => {
                          const count = documentCountByExpense.get(r.id) ?? 0;
                          return (
                            <Button
                              size="small"
                              icon={<PaperClipOutlined />}
                              disabled={count === 0}
                              onClick={() => {
                                setDocumentPurposeFilter(['expense']);
                                setDocumentExpenseIdFilter(r.id);
                                setActiveTab('documents');
                              }}
                            >
                              {count}
                            </Button>
                          );
                        },
                      },
                      {
                        title: '',
                        key: 'actions',
                        width: 80,
                        render: (_, r) => (
                          <Space>
                            <Button
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => {
                                setEditingExpense(r);
                                setExpenseOpen(true);
                              }}
                            />
                            <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => void handleDeleteExpense(r)}
                            />
                          </Space>
                        ),
                      },
                    ] as ColumnsType<ExpenseResponse>
                  }
                />
              </Space>
            ),
          },
          {
            key: 'documents',
            label: 'Документи',
            children: (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Space wrap>
                    <Typography.Text strong>Документи ({filteredDocuments.length})</Typography.Text>
                    <Select<DocumentPurpose[]>
                      mode="multiple"
                      value={documentPurposeFilter}
                      options={DOCUMENT_PURPOSE_OPTIONS}
                      style={{ minWidth: 220 }}
                      onChange={(values) => {
                        setDocumentPurposeFilter(values);
                        if (!values.includes('expense')) setDocumentExpenseIdFilter(null);
                      }}
                    />
                    {documentExpenseIdFilter ? (
                      <Tag closable onClose={() => setDocumentExpenseIdFilter(null)}>
                        Документи вибраної витрати
                      </Tag>
                    ) : null}
                  </Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setEditingDocument(undefined);
                      setDocOpen(true);
                    }}
                  >
                    Додати документ
                  </Button>
                </Space>
                <Table<DocumentResponse>
                  dataSource={filteredDocuments}
                  loading={docsLoading}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  locale={{ emptyText: 'Документів ще немає' }}
                  columns={
                    [
                      {
                        title: 'Назва',
                        dataIndex: 'name',
                        render: (name: string, r) =>
                          r.kind === 'upload' && r.mimeType?.startsWith('image/') ? (
                            <Space>
                              <Image
                                width={32}
                                height={32}
                                style={{ objectFit: 'cover' }}
                                src={documentsApi.getDownloadUrl(r.id, r.updatedAt)}
                                preview={false}
                              />
                              <span>{name}</span>
                            </Space>
                          ) : (
                            name
                          ),
                      },
                      {
                        title: 'Тип',
                        dataIndex: 'kind',
                        width: 90,
                        render: (k: string) => (
                          <Tag color={k === 'upload' ? 'blue' : 'green'}>
                            {k === 'upload' ? 'Файл' : 'Посилання'}
                          </Tag>
                        ),
                      },
                      {
                        title: 'Призначення',
                        key: 'purpose',
                        width: 120,
                        render: (_, r) =>
                          r.expenseId ? (
                            <Tag color="orange">Витрати</Tag>
                          ) : (
                            <Tag color="default">Загальні</Tag>
                          ),
                      },
                      {
                        title: 'Розмір',
                        dataIndex: 'sizeBytes',
                        width: 100,
                        render: (v: number | null) => (v ? `${(v / 1024).toFixed(0)} KB` : '—'),
                      },
                      {
                        title: 'Ким',
                        dataIndex: ['createdBy', 'fullName'],
                      },
                      {
                        title: 'Дата',
                        dataIndex: 'createdAt',
                        width: 110,
                        render: (v: string) => formatDate(v),
                      },
                      {
                        title: '',
                        key: 'actions',
                        width: 140,
                        render: (_, r) => (
                          <Space>
                            {r.kind === 'upload' ? (
                              <Button
                                size="small"
                                icon={<DownloadOutlined />}
                                href={documentsApi.getDownloadUrl(r.id, r.updatedAt)}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            ) : (
                              <Button
                                size="small"
                                icon={<LinkOutlined />}
                                onClick={() => window.open(r.url ?? '#', '_blank')}
                              />
                            )}
                            <Button
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => {
                                setEditingDocument(r);
                                setDocOpen(true);
                              }}
                            />
                            <Popconfirm
                              title="Видалити документ?"
                              okText="Так"
                              cancelText="Ні"
                              onConfirm={async () => {
                                await deleteDocument.mutateAsync(r.id);
                                void message.success('Документ видалено');
                              }}
                            >
                              <Button size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ] as ColumnsType<DocumentResponse>
                  }
                />
              </Space>
            ),
          },
          {
            key: 'history',
            label: 'Історія статусів',
            children: (
              <List
                dataSource={history?.items ?? []}
                locale={{ emptyText: 'Історія поки порожня' }}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space wrap>
                          <Tag>{item.oldStatus?.name ?? 'Старт'}</Tag>
                          <Typography.Text>→</Typography.Text>
                          <Tag color="blue">{item.newStatus?.name ?? '—'}</Tag>
                        </Space>
                      }
                      description={`${dayjs(item.changedAt).format('DD.MM.YYYY HH:mm')} · ${
                        item.changedBy.fullName
                      }${item.note ? ` · ${item.note}` : ''}`}
                    />
                  </List.Item>
                )}
              />
            ),
          },
          ...(isAdmin
            ? [
                {
                  key: 'public',
                  label: 'Публічна картка',
                  children: (
                    <Form form={form} layout="vertical" onFinish={handlePublicSave}>
                      <Form.Item label="Публічне авто">
                        <Space wrap>
                          <Form.Item name="isPublic" valuePropName="checked" noStyle>
                            <Switch />
                          </Form.Item>
                          {hasCompletePublicPage && publicVehicleUrl ? (
                            <Button
                              icon={<LinkOutlined />}
                              href={publicVehicleUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Відкрити публічну сторінку
                            </Button>
                          ) : (
                            <Typography.Text type="secondary">
                              Посилання зʼявиться після заповнення і збереження всіх публічних полів
                            </Typography.Text>
                          )}
                        </Space>
                      </Form.Item>
                      <Form.Item name="publicSummary" label="Публічний опис">
                        <Input.TextArea rows={3} />
                      </Form.Item>
                      <Space wrap>
                        <Form.Item name="publicCollectedAmountUah" label="Зібрано, UAH">
                          <InputNumber min={0} style={{ width: 220 }} />
                        </Form.Item>
                        <Form.Item name="publicGoalAmountUah" label="Ціль, UAH">
                          <InputNumber min={0} style={{ width: 220 }} />
                        </Form.Item>
                      </Space>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={updateVehicle.isPending}>
                          Зберегти публічні поля
                        </Button>
                      </Form.Item>
                    </Form>
                  ),
                },
              ]
            : []),
        ]}
      />
      <VehicleFormModal open={editOpen} vehicleId={vehicle.id} onClose={() => setEditOpen(false)} />
      <ExpenseFormModal
        open={expenseOpen}
        vehicleId={vehicle.id}
        vehicleBorderCrossingDate={vehicle.borderCrossingDate}
        expense={editingExpense}
        onClose={() => {
          setExpenseOpen(false);
          setEditingExpense(undefined);
        }}
      />
      <DocumentFormModal
        open={docOpen}
        vehicleId={vehicle.id}
        document={editingDocument}
        onClose={() => {
          setDocOpen(false);
          setEditingDocument(undefined);
        }}
        onSaved={() => {
          setEditingDocument(undefined);
        }}
      />
    </Space>
  );
}

interface VehiclePhotoGalleryProps {
  photos: Array<{ id: string }>;
  vehicleId: string;
  loading?: boolean;
}

function VehiclePhotoGallery({ photos, vehicleId, loading }: VehiclePhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(false);
  const thumbsRef = useRef<HTMLDivElement>(null);

  const photoUrls = useMemo(
    () => photos.map((photo) => vehiclesApi.getPhotoDownloadUrl(vehicleId, photo.id)),
    [photos, vehicleId],
  );

  useEffect(() => {
    if (activeIndex >= photos.length) setActiveIndex(0);
  }, [activeIndex, photos.length]);

  const scrollThumbs = (direction: -1 | 1) => {
    const el = thumbsRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * 200, behavior: 'smooth' });
  };

  const placeholder = (
    <div
      style={{
        width: '100%',
        aspectRatio: '4 / 3',
        background: '#f5f5f5',
        border: '1px dashed #d9d9d9',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        color: '#bfbfbf',
      }}
    >
      <PictureOutlined style={{ fontSize: 48, marginBottom: 8 }} />
      <Typography.Text type="secondary">Фото авто не додано</Typography.Text>
    </div>
  );

  if (loading && photos.length === 0) {
    return <Skeleton.Image active style={{ width: '100%', height: 360 }} />;
  }

  if (photos.length === 0) return placeholder;

  const activeUrl = photoUrls[activeIndex];

  return (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setPreviewVisible(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setPreviewVisible(true);
        }}
        style={{
          width: '100%',
          aspectRatio: '4 / 3',
          background: '#fafafa',
          borderRadius: 8,
          overflow: 'hidden',
          cursor: 'zoom-in',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={activeUrl}
          alt="Фото авто"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      <div style={{ display: 'none' }}>
        <Image.PreviewGroup
          preview={{
            visible: previewVisible,
            current: activeIndex,
            onVisibleChange: (v) => setPreviewVisible(v),
            onChange: (current) => setActiveIndex(current),
          }}
        >
          {photos.map((photo, i) => (
            <Image key={photo.id} src={photoUrls[i]} />
          ))}
        </Image.PreviewGroup>
      </div>

      {photos.length > 1 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            size="small"
            icon={<LeftOutlined />}
            onClick={() => scrollThumbs(-1)}
            aria-label="Прокрутити вліво"
          />
          <div
            ref={thumbsRef}
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              scrollBehavior: 'smooth',
              flex: 1,
              padding: '4px 0',
            }}
          >
            {photos.map((photo, i) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setActiveIndex(i)}
                style={{
                  flex: '0 0 auto',
                  width: 84,
                  height: 64,
                  padding: 0,
                  borderRadius: 6,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: '#fafafa',
                  border: i === activeIndex ? '2px solid #1677ff' : '1px solid #d9d9d9',
                  position: 'relative',
                }}
                aria-label={`Фото ${i + 1}`}
              >
                <img
                  src={photoUrls[i]}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </button>
            ))}
          </div>
          <Button
            size="small"
            icon={<RightOutlined />}
            onClick={() => scrollThumbs(1)}
            aria-label="Прокрутити вправо"
          />
        </div>
      ) : null}
    </Space>
  );
}
