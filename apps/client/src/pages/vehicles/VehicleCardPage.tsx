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
  Alert,
  Badge,
  Button,
  Col,
  Divider,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
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
  Timeline,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  Currency,
  DocumentResponse,
  DonationResponse,
  ExpenseFinancialEntry,
  ExpenseResponse,
  FinancialEntry,
  VehicleStatusHistory,
} from '@volunteerfleet/shared';
import { vehicleUpdateSchema } from '@volunteerfleet/shared';
import { DocumentDetailsModal } from '../../modals/DocumentDetailsModal';
import { DocumentFormModal } from '../../modals/DocumentFormModal';
import { DonationFormModal } from '../../modals/DonationFormModal';
import { ExpenseFormModal } from '../../modals/ExpenseFormModal';
import { StatusHistoryEditModal } from '../../modals/StatusHistoryEditModal';
import { StatusTransitionModal } from '../../modals/StatusTransitionModal';
import { VehicleFormModal } from '../../modals/VehicleFormModal';
import { VehicleStatusTag } from '../../components/VehicleStatusTag';
import {
  useDeleteVehicle,
  useRestoreVehicle,
  useRollbackLastStatus,
  useUpdateVehicle,
  useVehicle,
  useVehiclePhotos,
  useVehicleStatusHistory,
} from '../../hooks/useVehicles';
import { useDeleteDocument, useVehicleDocuments } from '../../hooks/useDocuments';
import { useDeleteExpense } from '../../hooks/useExpenses';
import { useDeleteDonation } from '../../hooks/useDonations';
import { useFinancialEntries } from '../../hooks/useFinancialEntries';
import { ALLOWED_TRANSITIONS, VEHICLE_STATUS_CONFIG } from '@volunteerfleet/shared';
import { useAuth, useOrgRole } from '../../stores/auth.store';
import { donationsApi } from '../../api/donations.api';
import { documentsApi } from '../../api/documents.api';
import { expensesApi } from '../../api/expenses.api';
import { vehiclesApi } from '../../api/vehicles.api';

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

export function VehicleCardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm<PublicFormValues>();
  const orgRole = useOrgRole();
  const role = useAuth((state) => state.user?.userRole);
  const isAdmin = role === 'superuser' || orgRole === 'coordinator';
  const canMutate = orgRole !== null && orgRole !== 'viewer';
  const { data: vehicle, isLoading } = useVehicle(id, isAdmin);
  const { data: history } = useVehicleStatusHistory(id);
  const updateVehicle = useUpdateVehicle();
  const deleteVehicle = useDeleteVehicle();
  const restoreVehicle = useRestoreVehicle();
  const rollbackLastStatus = useRollbackLastStatus(id);
  const [editOpen, setEditOpen] = useState(false);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [historyEditEntry, setHistoryEditEntry] = useState<VehicleStatusHistory | undefined>();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseResponse | undefined>();
  const [docOpen, setDocOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<DocumentResponse | undefined>();
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [activeTab, setActiveTab] = useState('finances');
  const [donationOpen, setDonationOpen] = useState(false);
  const [editingDonation, setEditingDonation] = useState<DonationResponse | undefined>();
  const [docModalExpense, setDocModalExpense] = useState<{
    vehicleId: string;
    expenseId: string;
  } | null>(null);
  const [documentPurposeFilter, setDocumentPurposeFilter] = useState<DocumentPurpose[]>([
    'general',
    'expense',
  ]);
  const [documentExpenseIdFilter, setDocumentExpenseIdFilter] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const deleteExpense = useDeleteExpense(id);
  const deleteDonation = useDeleteDonation();
  const { data: documentsData, isLoading: docsLoading } = useVehicleDocuments(id, {
    pageSize: 100,
  });
  const deleteDocument = useDeleteDocument(id);
  const { data: photosData, isLoading: photosLoading } = useVehiclePhotos(id);
  const { data: financialData, isLoading: financialLoading } = useFinancialEntries({
    vehicleId: id,
    pageSize: 100,
  });

  const documents = documentsData?.items ?? [];
  const photos = photosData?.items ?? [];
  const financialItems = financialData?.items ?? [];
  const financialSummary = financialData?.summary;
  const filteredDocuments = documents.filter((doc) => {
    const purpose: DocumentPurpose = doc.expenseId ? 'expense' : 'general';
    if (!documentPurposeFilter.includes(purpose)) return false;
    if (documentExpenseIdFilter && doc.expenseId !== documentExpenseIdFilter) return false;
    return true;
  });
  const hasCompletePublicPage =
    vehicle?.isPublic &&
    Boolean(vehicle.publicSummary?.trim()) &&
    vehicle.publicCollectedAmountUahMinor !== null &&
    vehicle.publicGoalAmountUahMinor !== null;
  const userObj = useAuth((state) => state.user);
  const publicVehicleUrl =
    vehicle?.isPublic && userObj?.activeOrgId
      ? `/public/${userObj.activeOrgId}/vehicles/${vehicle.id}`
      : null;

  useEffect(() => {
    if (!vehicle) return;
    form.setFieldsValue({
      isPublic: vehicle.isPublic,
      publicSummary: vehicle.publicSummary,
      publicCollectedAmountUah: vehicle.publicCollectedAmountUahMinor
        ? vehicle.publicCollectedAmountUahMinor / 100
        : null,
      publicGoalAmountUah: vehicle.publicGoalAmountUahMinor
        ? vehicle.publicGoalAmountUahMinor / 100
        : null,
    });
    setDescriptionDraft(vehicle.description ?? '');
  }, [form, vehicle]);

  if (isLoading) return <Skeleton active />;
  if (!vehicle) return <Empty description="Авто не знайдено" />;

  const handlePublicSave = async (values: PublicFormValues) => {
    const payload = {
      ...values,
      publicSummary: values.publicSummary?.trim() ? values.publicSummary.trim() : null,
      publicCollectedAmountUahMinor:
        values.publicCollectedAmountUah == null
          ? null
          : Math.round(values.publicCollectedAmountUah * 100),
      publicGoalAmountUahMinor:
        values.publicGoalAmountUah == null ? null : Math.round(values.publicGoalAmountUah * 100),
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

  const allowedNextStatuses = !vehicle.deletedAt ? (ALLOWED_TRANSITIONS[vehicle.status] ?? []) : [];

  const headerActions = (
    <Space wrap>
      <Button
        icon={<FileTextOutlined />}
        onClick={() => window.open(`/reports/vehicle/${vehicle.id}`, '_blank', 'noopener')}
      >
        Звіт по авто
      </Button>
      {canMutate && allowedNextStatuses.length > 0 && (
        <Button type="primary" onClick={() => setTransitionOpen(true)}>
          Змінити статус
        </Button>
      )}
      {canMutate && (
        <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
          Редагувати
        </Button>
      )}
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

  const statusTag = <VehicleStatusTag status={vehicle.status} deleted={Boolean(vehicle.deletedAt)} />;

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
              <Tag style={{ margin: 0 }}>
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
            key: 'finances',
            label: 'Фінанси',
            children: (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Row gutter={[16, 16]}>
                  <Col>
                    <Statistic
                      title="Витрати"
                      value={formatCurrency(financialSummary?.expensesUahMinor ?? 0, 'UAH')}
                    />
                  </Col>
                  <Col>
                    <Statistic
                      title="Донати"
                      value={formatCurrency(financialSummary?.donationsUahMinor ?? 0, 'UAH')}
                    />
                  </Col>
                  <Col>
                    <Statistic
                      title="Баланс"
                      value={formatCurrency(financialSummary?.balanceUahMinor ?? 0, 'UAH')}
                      valueStyle={{
                        color:
                          (financialSummary?.balanceUahMinor ?? 0) >= 0 ? '#389e0d' : '#cf1322',
                      }}
                    />
                  </Col>
                </Row>
                {canMutate && (
                  <Space wrap>
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
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingDonation(undefined);
                        setDonationOpen(true);
                      }}
                    >
                      Додати донат
                    </Button>
                  </Space>
                )}
                <Table<FinancialEntry>
                  dataSource={financialItems}
                  loading={financialLoading}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  locale={{ emptyText: 'Фінансових записів ще немає' }}
                  columns={
                    [
                      {
                        title: 'Дата',
                        dataIndex: 'entryDate',
                        render: (v: string) => formatDate(v),
                        width: 110,
                      },
                      {
                        title: 'Тип',
                        dataIndex: 'type',
                        width: 100,
                        render: (type: 'expense' | 'donation') =>
                          type === 'expense' ? (
                            <Tag color="red">Витрата</Tag>
                          ) : (
                            <Tag color="green">Донат</Tag>
                          ),
                      },
                      {
                        title: 'Сума',
                        key: 'amount',
                        align: 'right' as const,
                        width: 140,
                        render: (_: unknown, row: FinancialEntry) => (
                          <span style={{ color: row.type === 'expense' ? '#cf1322' : '#389e0d' }}>
                            {formatCurrency(row.amountMinor, row.currency as Currency)}
                          </span>
                        ),
                      },
                      {
                        title: 'UAH ≈',
                        key: 'amountUah',
                        align: 'right' as const,
                        width: 140,
                        render: (_: unknown, row: FinancialEntry) =>
                          row.currency !== 'UAH' ? formatCurrency(row.amountUahMinor, 'UAH') : null,
                      },
                      {
                        title: 'Деталі',
                        key: 'details',
                        render: (_: unknown, row: FinancialEntry) => {
                          if (row.type === 'expense') {
                            return <Tag>{row.category.name}</Tag>;
                          }
                          return row.donor.name;
                        },
                      },
                      {
                        title: 'Опис',
                        dataIndex: 'description',
                        width: 220,
                        ellipsis: true,
                        render: renderDescription,
                      },
                      {
                        title: 'Документи',
                        key: 'documents',
                        width: 90,
                        align: 'center' as const,
                        render: (_: unknown, row: FinancialEntry) => {
                          if (row.type !== 'expense') return null;
                          const expenseRow = row as ExpenseFinancialEntry;
                          const count = expenseRow.documentCount;
                          return (
                            <Tooltip
                              title={count > 0 ? 'Переглянути документи' : 'Немає документів'}
                            >
                              <Badge count={count} size="small">
                                <Button
                                  type="text"
                                  icon={<PaperClipOutlined />}
                                  disabled={count === 0}
                                  onClick={() =>
                                    setDocModalExpense({
                                      vehicleId: row.vehicle.id,
                                      expenseId: row.id,
                                    })
                                  }
                                />
                              </Badge>
                            </Tooltip>
                          );
                        },
                      },
                      ...(canMutate
                        ? [
                            {
                              title: 'Дії',
                              key: 'actions',
                              width: 90,
                              align: 'center' as const,
                              render: (_: unknown, row: FinancialEntry) => (
                                <Space size={0}>
                                  <Tooltip title="Редагувати">
                                    <Button
                                      type="text"
                                      icon={<EditOutlined />}
                                      onClick={() => {
                                        if (row.type === 'expense') {
                                          void expensesApi.get(row.id).then((expense) => {
                                            setEditingExpense(expense);
                                            setExpenseOpen(true);
                                          });
                                        } else {
                                          void donationsApi.get(row.id).then((donation) => {
                                            setEditingDonation(donation);
                                            setDonationOpen(true);
                                          });
                                        }
                                      }}
                                    />
                                  </Tooltip>
                                  <Popconfirm
                                    title="Видалити запис?"
                                    okText="Так"
                                    cancelText="Ні"
                                    onConfirm={() => {
                                      if (row.type === 'expense') {
                                        deleteExpense.mutate(row.id, {
                                          onSuccess: () => {
                                            void queryClient.invalidateQueries({
                                              queryKey: ['financial-entries'],
                                            });
                                          },
                                        });
                                      } else {
                                        deleteDonation.mutate(row.id, {
                                          onSuccess: () => {
                                            void queryClient.invalidateQueries({
                                              queryKey: ['financial-entries'],
                                            });
                                          },
                                        });
                                      }
                                    }}
                                  >
                                    <Tooltip title="Видалити">
                                      <Button type="text" danger icon={<DeleteOutlined />} />
                                    </Tooltip>
                                  </Popconfirm>
                                </Space>
                              ),
                            } as ColumnsType<FinancialEntry>[number],
                          ]
                        : []),
                    ] as ColumnsType<FinancialEntry>
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
                  {canMutate && (
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
                  )}
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
                        width: canMutate ? 140 : 60,
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
                            {canMutate && (
                              <>
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
                              </>
                            )}
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
            label: `Історія статусів${vehicle.alerts.length > 0 ? ` (${vehicle.alerts.length})` : ''}`,
            children:
              (history?.items ?? []).length === 0 ? (
                <Empty description="Історія поки порожня" />
              ) : (
                <Timeline
                  items={(history?.items ?? []).map((item, index) => {
                    const cfg = VEHICLE_STATUS_CONFIG[item.newStatus];
                    const itemAlerts = vehicle.alerts.filter(
                      (a) => a.vehicleStatusHistoryId === item.id,
                    );
                    const docs: { label: string; docId: string | null }[] = [
                      { label: 'Техпаспорт без печатки', docId: item.registrationDocId ?? null },
                      {
                        label: 'Техпаспорт з печаткою',
                        docId: item.stampedRegistrationDocId ?? null,
                      },
                      { label: 'Митна декларація', docId: item.customsDeclarationDocId ?? null },
                      {
                        label: 'Митна декларація з печатками',
                        docId: item.stampedCustomsDeclarationDocId ?? null,
                      },
                      { label: 'Акт (чернетка)', docId: item.transferActDraftDocId ?? null },
                      { label: 'Підписаний акт', docId: item.transferActSignedDocId ?? null },
                      { label: 'Акт повернення', docId: item.returnActDocId ?? null },
                    ].filter((d) => d.docId !== null);
                    return {
                      color: cfg?.color ?? 'blue',
                      children: (
                        <Space direction="vertical" size={2}>
                          <Space wrap size="small">
                            <Tag>
                              {item.oldStatus
                                ? VEHICLE_STATUS_CONFIG[item.oldStatus]?.label
                                : 'Старт'}
                            </Tag>
                            <Typography.Text>→</Typography.Text>
                            <VehicleStatusTag status={item.newStatus} />
                          </Space>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(item.transitionDate).format('DD.MM.YYYY')} (перехід) ·{' '}
                            {dayjs(item.changedAt).format('DD.MM.YYYY HH:mm')} ·{' '}
                            {item.changedBy.fullName}
                          </Typography.Text>
                          {item.lostReason && (
                            <Typography.Text style={{ fontSize: 12 }}>
                              Причина: {item.lostReason}
                            </Typography.Text>
                          )}
                          {item.note && (
                            <Typography.Text style={{ fontSize: 12 }}>
                              Примітка: {item.note}
                            </Typography.Text>
                          )}
                          {docs.length > 0 && (
                            <Space wrap size="small">
                              {docs.map((d) => (
                                <Button
                                  key={d.docId}
                                  size="small"
                                  icon={<PaperClipOutlined />}
                                  href={documentsApi.getDownloadUrl(d.docId!, '')}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {d.label}
                                </Button>
                              ))}
                            </Space>
                          )}
                          {canMutate && (
                            <Space wrap size="small">
                              <Button
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => setHistoryEditEntry(item)}
                              >
                                Редагувати
                              </Button>
                              {orgRole === 'coordinator' &&
                                !vehicle.deletedAt &&
                                index === 0 &&
                                item.oldStatus && (
                                  <Popconfirm
                                    title="Відкотити останній статус?"
                                    description="Авто повернеться до попереднього статусу, а цей запис історії буде видалено."
                                    okText="Відкотити"
                                    cancelText="Скасувати"
                                    onConfirm={async () => {
                                      try {
                                        await rollbackLastStatus.mutateAsync(item.id);
                                        message.success('Останній статус відкочено');
                                      } catch {
                                        message.error(
                                          'Не вдалося відкотити статус. Можливо, зʼявився новіший перехід — оновіть сторінку.',
                                        );
                                      }
                                    }}
                                  >
                                    <Button size="small" danger icon={<RollbackOutlined />}>
                                      Відкотити
                                    </Button>
                                  </Popconfirm>
                                )}
                            </Space>
                          )}
                          {itemAlerts.length > 0 && (
                            <Space
                              direction="vertical"
                              size="small"
                              style={{ marginTop: 8, width: '100%' }}
                            >
                              {itemAlerts.map((alert) => (
                                <Alert
                                  key={alert.type}
                                  type="warning"
                                  message={alert.message}
                                  showIcon
                                />
                              ))}
                            </Space>
                          )}
                        </Space>
                      ),
                    };
                  })}
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
      <StatusTransitionModal
        open={transitionOpen}
        vehicle={vehicle}
        lastHistoryEntry={history?.items[0]}
        onClose={() => setTransitionOpen(false)}
        onPaidTransition={() => {
          Modal.confirm({
            title: 'Додати витрату на купівлю авто?',
            content: 'Бажаєте додати витрату «Купівля авто»?',
            okText: 'Додати витрату',
            cancelText: 'Пропустити',
            onOk: () => {
              setEditingExpense(undefined);
              setExpenseOpen(true);
            },
          });
        }}
      />
      {historyEditEntry && (
        <StatusHistoryEditModal
          open={Boolean(historyEditEntry)}
          vehicleId={vehicle.id}
          entry={historyEditEntry}
          onClose={() => setHistoryEditEntry(undefined)}
        />
      )}
      <VehicleFormModal open={editOpen} vehicleId={vehicle.id} onClose={() => setEditOpen(false)} />
      <ExpenseFormModal
        open={expenseOpen}
        vehicleId={vehicle.id}
        vehicleBorderCrossingDate={vehicle.borderCrossingDate}
        vehicleStartDate={vehicle.startDate}
        expense={editingExpense}
        onClose={() => {
          setExpenseOpen(false);
          setEditingExpense(undefined);
        }}
      />
      <DonationFormModal
        open={donationOpen}
        vehicleId={vehicle.id}
        donation={editingDonation}
        onClose={() => {
          setDonationOpen(false);
          setEditingDonation(undefined);
        }}
      />
      {docModalExpense && (
        <ExpenseDocsModal
          vehicleId={docModalExpense.vehicleId}
          expenseId={docModalExpense.expenseId}
          onClose={() => setDocModalExpense(null)}
        />
      )}
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

interface ExpenseDocsModalProps {
  vehicleId: string;
  expenseId: string;
  onClose: () => void;
}

function ExpenseDocsModal({ vehicleId, expenseId, onClose }: ExpenseDocsModalProps) {
  const { data } = useVehicleDocuments(vehicleId, { expenseId, pageSize: 100 });
  const documentIds = (data?.items ?? []).map((d) => d.id);
  return (
    <DocumentDetailsModal
      open={documentIds.length > 0}
      documentIds={documentIds}
      onClose={onClose}
    />
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
