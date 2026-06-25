import { useEffect, useState } from 'react';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileTextOutlined,
  LinkOutlined,
  PaperClipOutlined,
  PictureOutlined,
  PlusOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import {
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
  Skeleton,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
  Flex,
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
  VehicleGalleryResponse,
  VehicleStatusHistory,
} from '@volunteerfleet/shared';
import {
  VEHICLE_GALLERY_MAX_ITEMS,
  VEHICLE_GALLERY_PRESENTATION,
  vehicleUpdateSchema,
} from '@volunteerfleet/shared';
import { DocumentDetailsModal } from '../../modals/DocumentDetailsModal';
import { DocumentFormModal } from '../../modals/DocumentFormModal';
import { DonationFormModal } from '../../modals/DonationFormModal';
import { ExpenseFormModal } from '../../modals/ExpenseFormModal';
import { StatusHistoryEditModal } from '../../modals/StatusHistoryEditModal';
import { StatusTransitionModal } from '../../modals/StatusTransitionModal';
import { VehicleFormModal } from '../../modals/VehicleFormModal';
import { VehicleGalleryModal } from '../../modals/VehicleGalleryModal';
import { VehicleStatusTag } from '../../components/VehicleStatusTag';
import {
  useDeleteVehicle,
  useRestoreVehicle,
  useRollbackLastStatus,
  useUpdateVehicle,
  useVehicle,
  useVehicleStatusHistory,
} from '../../hooks/useVehicles';
import { useDeleteDocument, useVehicleDocuments } from '../../hooks/useDocuments';
import { useDeleteVehicleGallery, useVehicleGalleries } from '../../hooks/useVehicleGalleries';
import { vehicleGalleriesApi } from '../../api/vehicle-galleries.api';
import { useDeleteExpense } from '../../hooks/useExpenses';
import { useDeleteDonation } from '../../hooks/useDonations';
import { useFinancialEntries } from '../../hooks/useFinancialEntries';
import { ALLOWED_TRANSITIONS } from '@volunteerfleet/shared';
import { useAuth, useOrgRole } from '../../stores/auth.store';
import { donationsApi } from '../../api/donations.api';
import { documentsApi } from '../../api/documents.api';
import { documentGroupsApi } from '../../api/documentGroups.api';
import { expensesApi } from '../../api/expenses.api';
import { StatusHistoryTimeline } from '../../components/StatusHistoryTimeline';
import { GroupEditModal } from '../../modals/GroupEditModal';

import { formatCurrency, formatDate } from '../../utils/format';

interface PublicFormValues {
  isPublic: boolean;
  publicSummary?: string | null;
  publicCollectedAmountUah?: number | null;
  publicGoalAmountUah?: number | null;
}

type DocLeafRow = DocumentResponse & { key: string; isGroup?: false; isGroupChild?: boolean };
type DocGroupRow = {
  key: string;
  isGroup: true;
  groupId: string;
  name: string;
  count: number;
  expenseIds: string[];
  createdBy: DocumentResponse['createdBy'];
  createdAt: string;
  children: DocLeafRow[];
};
type DocTableRow = DocLeafRow | DocGroupRow;

// Collapses documents that share a group (2+ files) into one expandable parent
// row. A group with a single file — and any ungrouped document — renders as a
// plain top-level row, so single-file groups look like ordinary files.
function buildDocumentTableRows(docs: DocumentResponse[]): DocTableRow[] {
  const groupOrder: string[] = [];
  const groupMap = new Map<string, DocumentResponse[]>();
  const rows: DocTableRow[] = [];
  for (const doc of docs) {
    if (doc.groupId) {
      if (!groupMap.has(doc.groupId)) {
        groupMap.set(doc.groupId, []);
        groupOrder.push(doc.groupId);
      }
      groupMap.get(doc.groupId)!.push(doc);
    } else {
      rows.push({ ...doc, key: doc.id });
    }
  }
  for (const groupId of groupOrder) {
    const groupDocs = groupMap.get(groupId)!;
    if (groupDocs.length === 1) {
      rows.push({ ...groupDocs[0]!, key: groupDocs[0]!.id });
      continue;
    }
    const first = groupDocs[0]!;
    rows.push({
      key: `group-${groupId}`,
      isGroup: true,
      groupId,
      name: first.group?.name?.trim() || `Документ (${groupDocs.length})`,
      count: groupDocs.length,
      expenseIds: first.group?.expenseIds ?? [],
      createdBy: first.createdBy,
      createdAt: groupDocs.reduce(
        (min, d) => (d.createdAt < min ? d.createdAt : min),
        first.createdAt,
      ),
      children: groupDocs.map((d) => ({ ...d, key: d.id, isGroupChild: true })),
    });
  }
  return rows;
}

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
  const [groupEditOpen, setGroupEditOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | undefined>();
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [activeTab, setActiveTab] = useState('finances');
  const [donationOpen, setDonationOpen] = useState(false);
  const [editingDonation, setEditingDonation] = useState<DonationResponse | undefined>();
  const [docModalExpense, setDocModalExpense] = useState<{
    vehicleId: string;
    expenseId: string;
  } | null>(null);
  const [documentExpenseIdFilter, setDocumentExpenseIdFilter] = useState<string | null>(null);
  const [previewDocuments, setPreviewDocuments] = useState<DocumentResponse[] | undefined>();
  const [previewInitialIndex, setPreviewInitialIndex] = useState(0);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [editingGallery, setEditingGallery] = useState<VehicleGalleryResponse | undefined>();

  const queryClient = useQueryClient();
  const deleteExpense = useDeleteExpense(id);
  const deleteDonation = useDeleteDonation();
  const { data: documentsData, isLoading: docsLoading } = useVehicleDocuments(id, {
    pageSize: 100,
  });
  const deleteDocument = useDeleteDocument(id);
  const { data: galleriesData, isLoading: galleriesLoading } = useVehicleGalleries(id);
  const deleteGallery = useDeleteVehicleGallery(id ?? '');
  const { data: financialData, isLoading: financialLoading } = useFinancialEntries({
    vehicleId: id,
    pageSize: 100,
  });

  const documents = documentsData?.items ?? [];
  const financialItems = financialData?.items ?? [];
  const financialSummary = financialData?.summary;
  const galleries = galleriesData?.items ?? [];
  const currentEditingGallery = editingGallery
    ? (galleries.find((g) => g.id === editingGallery.id) ?? editingGallery)
    : undefined;
  const mainGallery = galleries.find((g) => g.kind === 'main');
  const customGalleries = galleries.filter((g) => g.kind === 'custom');
  const filteredDocuments = documents.filter((doc) => {
    const expenseIds = doc.group?.expenseIds ?? [];
    if (documentExpenseIdFilter && !expenseIds.includes(documentExpenseIdFilter)) return false;
    return true;
  });
  const documentTableRows = buildDocumentTableRows(filteredDocuments);
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

  const handleRollbackStatus = async (entry: VehicleStatusHistory) => {
    try {
      await rollbackLastStatus.mutateAsync(entry.id);
      message.success('Останній статус відкочено');
    } catch {
      message.error(
        'Не вдалося відкотити статус. Можливо, зʼявився новіший перехід — оновіть сторінку.',
      );
    }
  };

  const isLocalPurchase = (history?.items ?? []).some(
    (h) => h.newStatus === 'paid' && h.isLocalPurchase,
  );
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

  const statusTag = (
    <VehicleStatusTag status={vehicle.status} deleted={Boolean(vehicle.deletedAt)} />
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
          <VehicleMainGallerySection
            vehicleId={vehicle.id}
            mainGallery={mainGallery}
            loading={galleriesLoading}
            canMutate={canMutate}
            onOpenGallery={(g) => {
              setEditingGallery(g);
              setGalleryModalOpen(true);
            }}
          />
          {(customGalleries.length > 0 || canMutate) && (
            <>
              <Space
                align="center"
                style={{
                  justifyContent: 'space-between',
                  width: '100%',
                  marginBottom: 8,
                  marginTop: 16,
                }}
              >
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  ДОДАТКОВІ ГАЛЕРЕЇ
                </Typography.Text>
                {canMutate && (
                  <Button
                    size="small"
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setEditingGallery(undefined);
                      setGalleryModalOpen(true);
                    }}
                  >
                    Додати галерею
                  </Button>
                )}
              </Space>
              <div
                style={{
                  display: 'flex',
                  overflowX: 'auto',
                  gap: 12,
                  paddingBottom: 8,
                }}
              >
                {customGalleries.map((g) => {
                  const coverId = g.effectiveCoverItemId;
                  const coverUrl = coverId
                    ? vehicleGalleriesApi.getItemDownloadUrl(vehicle.id, g.id, coverId)
                    : null;
                  return (
                    <div key={g.id} style={{ minWidth: 200, width: 200, flexShrink: 0 }}>
                      <GalleryCard
                        gallery={g}
                        vehicleId={vehicle.id}
                        label={g.name ?? ''}
                        coverUrl={coverUrl}
                        canMutate={canMutate}
                        small
                        onEdit={() => {
                          setEditingGallery(g);
                          setGalleryModalOpen(true);
                        }}
                        onDelete={async () => {
                          await deleteGallery.mutateAsync(g.id);
                          message.success('Галерею видалено');
                        }}
                      />
                    </div>
                  );
                })}
                {customGalleries.length === 0 && (
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    Немає додаткових галерей
                  </Typography.Text>
                )}
              </div>
            </>
          )}
        </Col>
        <Col xs={24} lg={16}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space wrap size="small">
              <Tag style={{ margin: 0 }}>ID: {vehicle.identifier}</Tag>
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
                  ПОЧАТКОВА ДАТА
                </Typography.Text>
                <div>
                  <Typography.Text strong>
                    {dayjs(vehicle.startDate).format('DD.MM.YYYY')}
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
                    {documentExpenseIdFilter ? (
                      <Tag closable onClose={() => setDocumentExpenseIdFilter(null)}>
                        Документи вибраної витрати
                      </Tag>
                    ) : null}
                  </Space>
                  {canMutate && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setDocOpen(true)}>
                      Додати документ
                    </Button>
                  )}
                </Space>
                <Table<DocTableRow>
                  dataSource={documentTableRows}
                  loading={docsLoading}
                  rowKey="key"
                  size="small"
                  pagination={false}
                  locale={{ emptyText: 'Документів ще немає' }}
                  onRow={(record) => ({
                    onClick: () => {
                      if (record.isGroup) {
                        setPreviewInitialIndex(0);
                        setPreviewDocuments(record.children);
                        return;
                      }
                      if (record.groupId) {
                        const group = documentTableRows.find(
                          (r): r is DocGroupRow =>
                            r.isGroup === true && r.groupId === record.groupId,
                        );
                        if (group) {
                          const index = group.children.findIndex((c) => c.id === record.id);
                          setPreviewInitialIndex(Math.max(0, index));
                          setPreviewDocuments(group.children);
                          return;
                        }
                      }
                      setPreviewInitialIndex(0);
                      setPreviewDocuments([record]);
                    },
                  })}
                  columns={
                    [
                      {
                        title: 'Назва',
                        dataIndex: 'name',
                        render: (name: string, r) => {
                          if (r.isGroup) {
                            return (
                              <Space>
                                <FileTextOutlined />
                                <span style={{ fontWeight: 500 }}>{r.name}</span>
                                <Tag>{r.count} файл.</Tag>
                              </Space>
                            );
                          }
                          return r.kind === 'upload' && r.mimeType?.startsWith('image/') ? (
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
                          );
                        },
                      },
                      {
                        title: 'Тип',
                        key: 'kind',
                        width: 90,
                        render: (_, r) =>
                          r.isGroup ? (
                            <Tag color="purple">Група</Tag>
                          ) : (
                            <Tag color={r.kind === 'upload' ? 'blue' : 'green'}>
                              {r.kind === 'upload' ? 'Файл' : 'Посилання'}
                            </Tag>
                          ),
                      },
                      {
                        title: 'Розмір',
                        key: 'size',
                        width: 100,
                        render: (_, r) =>
                          !r.isGroup && r.sizeBytes ? `${(r.sizeBytes / 1024).toFixed(0)} KB` : '—',
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
                        render: (_, r) => {
                          if (r.isGroup) {
                            if (!canMutate) return null;
                            return (
                              <Flex justify="flex-end" gap="small">
                                <Button
                                  size="small"
                                  icon={<EditOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingGroupId(r.groupId);
                                    setGroupEditOpen(true);
                                  }}
                                />
                                <span onClick={(e) => e.stopPropagation()}>
                                  <Popconfirm
                                    title="Видалити цей документ (групу файлів)?"
                                    okText="Так"
                                    cancelText="Ні"
                                    onConfirm={async () => {
                                      try {
                                        await documentGroupsApi.remove(r.groupId);
                                        void queryClient.invalidateQueries({
                                          queryKey: ['documents', 'vehicle', vehicle.id],
                                        });
                                        void message.success('Документ видалено');
                                      } catch {
                                        void message.error('Не вдалося видалити групу');
                                      }
                                    }}
                                  >
                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                  </Popconfirm>
                                </span>
                              </Flex>
                            );
                          }
                          return (
                            <Flex justify="flex-end" gap="small">
                              {r.kind === 'upload' ? (
                                <Button
                                  size="small"
                                  icon={<DownloadOutlined />}
                                  href={documentsApi.getDownloadUrl(r.id, r.updatedAt)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <Button
                                  size="small"
                                  icon={<LinkOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(r.url ?? '#', '_blank');
                                  }}
                                />
                              )}
                              {canMutate && (
                                <>
                                  {!r.isGroupChild && r.groupId && (
                                    <Button
                                      size="small"
                                      icon={<EditOutlined />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingGroupId(r.groupId ?? undefined);
                                        setGroupEditOpen(true);
                                      }}
                                    />
                                  )}
                                  <span onClick={(e) => e.stopPropagation()}>
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
                                  </span>
                                </>
                              )}
                            </Flex>
                          );
                        },
                      },
                    ] as ColumnsType<DocTableRow>
                  }
                />
                <DocumentDetailsModal
                  open={previewDocuments != null}
                  documents={previewDocuments}
                  initialIndex={previewInitialIndex}
                  onClose={() => setPreviewDocuments(undefined)}
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
                <StatusHistoryTimeline
                  items={history?.items ?? []}
                  alerts={vehicle.alerts}
                  canMutate={canMutate}
                  canRollback={orgRole === 'coordinator' && !vehicle.deletedAt}
                  rollbackPending={rollbackLastStatus.isPending}
                  onEdit={setHistoryEditEntry}
                  onRollback={(entry) => void handleRollbackStatus(entry)}
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
        isLocalPurchase={isLocalPurchase}
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
          isLocalPurchase={isLocalPurchase}
          onClose={() => setHistoryEditEntry(undefined)}
        />
      )}
      <VehicleFormModal open={editOpen} vehicleId={vehicle.id} onClose={() => setEditOpen(false)} />
      <ExpenseFormModal
        open={expenseOpen}
        vehicleId={vehicle.id}
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
      <DocumentFormModal open={docOpen} vehicleId={vehicle.id} onClose={() => setDocOpen(false)} />
      {editingGroupId && (
        <GroupEditModal
          open={groupEditOpen}
          vehicleId={vehicle.id}
          groupId={editingGroupId}
          onClose={() => {
            setGroupEditOpen(false);
            setEditingGroupId(undefined);
          }}
        />
      )}
      <VehicleGalleryModal
        open={galleryModalOpen}
        vehicleId={vehicle.id}
        gallery={currentEditingGallery}
        allGalleries={galleriesData?.items ?? []}
        canMutate={canMutate}
        onClose={() => {
          setGalleryModalOpen(false);
          setEditingGallery(undefined);
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
  const documents = data?.items ?? [];
  return (
    <DocumentDetailsModal open={documents.length > 0} documents={documents} onClose={onClose} />
  );
}

interface VehicleMainGallerySectionProps {
  vehicleId: string;
  mainGallery?: VehicleGalleryResponse;
  loading: boolean;
  canMutate: boolean;
  onOpenGallery: (gallery: VehicleGalleryResponse) => void;
}

function VehicleMainGallerySection({
  vehicleId,
  mainGallery,
  loading,
  canMutate,
  onOpenGallery,
}: VehicleMainGallerySectionProps) {
  if (loading && !mainGallery) {
    return <Skeleton.Image active style={{ width: '100%', height: 360 }} />;
  }

  const getCoverUrl = (gallery: VehicleGalleryResponse): string | null => {
    const coverId = gallery.effectiveCoverItemId;
    if (!coverId) return null;
    return vehicleGalleriesApi.getItemDownloadUrl(vehicleId, gallery.id, coverId);
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <GalleryCard
        gallery={mainGallery}
        vehicleId={vehicleId}
        label={VEHICLE_GALLERY_PRESENTATION.main.label}
        coverUrl={mainGallery ? getCoverUrl(mainGallery) : null}
        canMutate={canMutate}
        onEdit={() => mainGallery && onOpenGallery(mainGallery)}
      />
    </Space>
  );
}

interface GalleryCardProps {
  gallery?: VehicleGalleryResponse;
  vehicleId: string;
  label: string;
  coverUrl: string | null;
  canMutate: boolean;
  onEdit: () => void;
  onDelete?: () => void;
  small?: boolean;
}

function GalleryCard({
  gallery,
  vehicleId,
  label,
  coverUrl,
  canMutate,
  onEdit,
  onDelete,
  small,
}: GalleryCardProps) {
  const [previewVisible, setPreviewVisible] = useState(false);
  const isMain = gallery?.kind === 'main';
  const itemCount = gallery?.items.length ?? 0;

  return (
    <div
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
        position: 'relative',
      }}
    >
      {canMutate && gallery && (
        <Space
          size={4}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            zIndex: 10,
          }}
        >
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          />
          {!isMain && onDelete && (
            <Popconfirm
              title="Видалити галерею?"
              description="Усі фото в цій галереї буде видалено."
              okText="Видалити"
              cancelText="Скасувати"
              onConfirm={(e) => {
                e?.stopPropagation();
                onDelete();
              }}
              onCancel={(e) => e?.stopPropagation()}
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          )}
        </Space>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (itemCount > 0) setPreviewVisible(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (itemCount > 0) setPreviewVisible(true);
          }
        }}
        style={{ cursor: itemCount > 0 ? 'pointer' : 'default' }}
      >
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            background: '#f5f5f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={label}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <PictureOutlined style={{ fontSize: small ? 24 : 36, color: '#bfbfbf' }} />
          )}
        </div>
        <div style={{ padding: small ? '6px 8px' : '8px 12px' }}>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Space size="small">
              <Typography.Text strong style={{ fontSize: small ? 13 : undefined }}>
                {label}
              </Typography.Text>
              {gallery && !gallery.isPublic && (
                <Tooltip title="Приватна">
                  <EyeInvisibleOutlined style={{ color: '#8c8c8c' }} />
                </Tooltip>
              )}
              {gallery?.isPublic && !isMain && (
                <Tooltip title="Публічна">
                  <EyeOutlined style={{ color: '#52c41a' }} />
                </Tooltip>
              )}
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: small ? 11 : 12 }}>
              {itemCount} / {VEHICLE_GALLERY_MAX_ITEMS}
            </Typography.Text>
          </Space>
          {!small && gallery?.description && (
            <Typography.Paragraph
              type="secondary"
              ellipsis={{ rows: 1 }}
              style={{ margin: '4px 0 0', fontSize: 12 }}
            >
              {gallery.description}
            </Typography.Paragraph>
          )}
        </div>
      </div>

      {gallery && gallery.items.length > 0 && (
        <div style={{ display: 'none' }}>
          <Image.PreviewGroup
            preview={{
              visible: previewVisible,
              onVisibleChange: (vis) => setPreviewVisible(vis),
            }}
          >
            {gallery.items.map((item) => (
              <Image
                key={item.id}
                src={vehicleGalleriesApi.getItemDownloadUrl(vehicleId, gallery.id, item.id)}
              />
            ))}
          </Image.PreviewGroup>
        </div>
      )}
    </div>
  );
}
