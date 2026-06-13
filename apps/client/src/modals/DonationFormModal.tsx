import { Button, DatePicker, Form, Input, Modal, Select, Space, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Currency, DonationResponse } from '@volunteerfleet/shared';
import { donationCreateSchema } from '@volunteerfleet/shared';
import { documentsApi } from '../api/documents.api';
import { documentGroupsApi } from '../api/documentGroups.api';
import {
  FileAttachmentField,
  type FileAttachmentExistingItem,
  type FileAttachmentNewFile,
  type FileAttachmentNewLink,
} from '../components/files/FileAttachmentField';
import { GroupingToggle } from '../components/files/GroupingToggle';
import { MoneyFields } from '../components/MoneyFields';
import { DonorPicker } from '../components/DonorPicker';
import { useCreateDonation, useUpdateDonation, useDonationsList } from '../hooks/useDonations';
import { useDeleteDocument, useVehicleDocuments } from '../hooks/useDocuments';
import { useDictionary } from '../hooks/useDictionaries';
import { useVehicles, useVehicleStatusHistory } from '../hooks/useVehicles';
import type { FinancialCategory } from '@volunteerfleet/shared';
import type { DocumentDetachAction } from '../utils/documentDetachConfirm';
import { confirmDocumentDetachAction } from '../utils/documentDetachConfirm';
import { buildDocumentGroup, MOVE_CANCELLED } from '../utils/buildDocumentGroup';
import { buildDocumentPickerItems } from '../utils/documentPickerItems';

interface DonationFormModalProps {
  open: boolean;
  vehicleId?: string;
  donation?: DonationResponse;
  onClose: () => void;
  onCreated?: (donation: DonationResponse) => void;
}

interface FormValues {
  donationDate: dayjs.Dayjs;
  amount: number;
  currency: Currency;
  rate: number;
  categoryId?: string;
  donorId: string;
  description?: string;
}

const MAX_SIZE_BYTES = 26_214_400;
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

export function DonationFormModal({
  open,
  vehicleId,
  donation,
  onClose,
  onCreated,
}: DonationFormModalProps) {
  const [form] = Form.useForm<FormValues>();
  const queryClient = useQueryClient();
  const isEdit = !!donation;
  const needsVehiclePick = !vehicleId && !isEdit;

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(vehicleId);
  const effectiveVehicleId = vehicleId ?? donation?.vehicleId ?? selectedVehicleId;

  const { data: vehiclesData } = useVehicles({ pageSize: 100 });
  const { data: categoriesData } = useDictionary('financial-categories');
  const categories = (categoriesData ?? []) as FinancialCategory[];

  const [currency, setCurrency] = useState<Currency>('UAH');
  const [donationDate, setDonationDate] = useState<string | undefined>();
  const [rateSource, setRateSource] = useState<'default' | 'manual'>('default');
  const [amount, setAmount] = useState<number>(0);
  const [rate, setRate] = useState<number>(1);
  const [newFiles, setNewFiles] = useState<FileAttachmentNewFile[]>([]);
  const [newLinks, setNewLinks] = useState<FileAttachmentNewLink[]>([]);
  const [selectedExistingDocumentIds, setSelectedExistingDocumentIds] = useState<string[]>([]);
  const [removedDocumentIds, setRemovedDocumentIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const isDonationDateManuallyChangedRef = useRef(false);

  const selectedVehicle = vehiclesData?.items.find((v) => v.id === effectiveVehicleId);

  const { data: latestDonationData } = useDonationsList(
    !isEdit && effectiveVehicleId
      ? { vehicleId: effectiveVehicleId, page: 1, pageSize: 1, sort: 'donationDate:desc' }
      : undefined,
  );
  const { data: statusHistoryData } = useVehicleStatusHistory(
    !isEdit && effectiveVehicleId ? effectiveVehicleId : undefined,
  );

  const latestDonationDate = latestDonationData?.items[0]?.donationDate;
  const latestStatusTransitionDate = statusHistoryData?.items[0]?.transitionDate;

  const suggestedDonationDate =
    latestDonationDate ??
    (selectedVehicle?.status !== 'new' ? latestStatusTransitionDate : undefined) ??
    selectedVehicle?.startDate ??
    dayjs().format('YYYY-MM-DD');

  const createDonation = useCreateDonation();
  const updateDonation = useUpdateDonation();
  const deleteDocument = useDeleteDocument(effectiveVehicleId);

  const { data: attachedDocsData, isLoading: attachedDocsLoading } = useVehicleDocuments(
    donation?.id ? effectiveVehicleId : undefined,
    donation?.id ? { donationId: donation.id, pageSize: 100 } : undefined,
  );
  const { data: vehicleDocsData, isLoading: vehicleDocsLoading } = useVehicleDocuments(
    effectiveVehicleId,
    { pageSize: 100, excludeStatusBound: true },
  );
  const attachedDocs = donation?.id ? (attachedDocsData?.items ?? []) : [];

  useEffect(() => {
    if (!open) return;
    if (donation) {
      setCurrency(donation.currency);
      setDonationDate(donation.donationDate);
      setRateSource(donation.rateSource);
      setAmount(donation.amountMinor / 100);
      setRate(donation.rate);
      setNewFiles([]);
      setNewLinks([]);
      setSelectedExistingDocumentIds([]);
      setRemovedDocumentIds([]);
      setGroupName('');
      isDonationDateManuallyChangedRef.current = false;
      form.setFieldsValue({
        donationDate: dayjs(donation.donationDate),
        amount: donation.amountMinor / 100,
        currency: donation.currency,
        rate: donation.rate,
        categoryId: donation.categoryId ?? undefined,
        donorId: donation.donorId,
        description: donation.description ?? undefined,
      });
    } else {
      form.resetFields();
      setSelectedVehicleId(vehicleId);
      setCurrency('UAH');
      setDonationDate(dayjs().format('YYYY-MM-DD'));
      setRateSource('default');
      setAmount(0);
      setRate(1);
      setNewFiles([]);
      setNewLinks([]);
      setSelectedExistingDocumentIds([]);
      setRemovedDocumentIds([]);
      setGroupName('');
      isDonationDateManuallyChangedRef.current = false;
      form.setFieldsValue({
        donationDate: dayjs(),
        currency: 'UAH',
        rate: 1,
      });
    }
  }, [open, donation, form, vehicleId]);

  useEffect(() => {
    if (!open || isEdit || isDonationDateManuallyChangedRef.current) return;
    setDonationDate(suggestedDonationDate);
    form.setFieldValue('donationDate', dayjs(suggestedDonationDate));
  }, [form, isEdit, open, suggestedDonationDate]);

  const onFinish = async (values: FormValues) => {
    if (!effectiveVehicleId) {
      message.error('Оберіть автомобіль');
      return;
    }
    const normalizedDate = values.donationDate.format('YYYY-MM-DD');
    const effectiveRate = values.currency === 'UAH' ? 1 : Number(values.rate);
    const payload = {
      vehicleId: effectiveVehicleId,
      donationDate: normalizedDate,
      amountMinor: Math.round(Number(values.amount) * 100),
      currency: values.currency,
      rate: effectiveRate,
      categoryId: values.categoryId ?? null,
      description: values.description || null,
      donorId: values.donorId,
    };

    const parsed = donationCreateSchema.safeParse(payload);
    if (!parsed.success) {
      message.error(parsed.error.issues[0]?.message ?? 'Помилка валідації');
      return;
    }

    try {
      const detachAction =
        removedDocumentIds.length > 0
          ? await confirmDocumentDetachAction({
              count: removedDocumentIds.length,
              title: 'Що зробити з прибраними документами?',
              description:
                'Ви прибрали документи з надходження. Оберіть, видалити їх повністю чи лише відвʼязати від цього надходження.',
            })
          : null;
      if (removedDocumentIds.length > 0 && !detachAction) return;

      if (isEdit) {
        await updateDonation.mutateAsync({ id: donation.id, payload: parsed.data });
        await syncAttachments(
          donation.id,
          effectiveVehicleId,
          donation.documentGroupId,
          detachAction,
        );
        message.success('Надходження оновлено');
        onClose();
      } else {
        const created = await createDonation.mutateAsync(parsed.data);
        await syncAttachments(
          created.id,
          effectiveVehicleId,
          created.documentGroupId,
          detachAction,
        );
        message.success('Надходження додано');
        onCreated?.(created);
        onClose();
      }
      setNewFiles([]);
      setNewLinks([]);
      setSelectedExistingDocumentIds([]);
      setRemovedDocumentIds([]);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === MOVE_CANCELLED) return;
      message.error('Помилка при збереженні надходження');
    }
  };

  const syncAttachments = async (
    donationId: string,
    targetVehicleId: string,
    existingGroupId: string | null,
    detachAction: DocumentDetachAction | null,
  ) => {
    const resolvedDocIds = selectedExistingDocumentIds.flatMap((id) => picker.docIdsById[id] ?? []);
    const selectedExisting = vehicleDocs
      .filter((doc) => resolvedDocIds.includes(doc.id))
      .map((doc) => ({ id: doc.id, name: doc.name, groupId: doc.groupId }));

    await buildDocumentGroup({
      vehicleId: targetVehicleId,
      donationId,
      name: groupName.trim() || 'Документи надходження',
      newFiles,
      newLinks,
      selectedExisting,
      existingGroupId,
    });
    if (existingGroupId && groupName.trim()) {
      await documentGroupsApi.update(existingGroupId, { name: groupName.trim() });
    }

    if (detachAction === 'delete') {
      for (const documentId of removedDocumentIds) {
        await deleteDocument.mutateAsync(documentId);
      }
    } else if (detachAction === 'unlink') {
      for (const documentId of removedDocumentIds) {
        const group = await documentGroupsApi.create({ vehicleId: targetVehicleId });
        try {
          await documentGroupsApi.moveDocument(group.id, documentId);
        } catch (error) {
          await documentGroupsApi.remove(group.id);
          throw error;
        }
      }
    }

    void queryClient.invalidateQueries({ queryKey: ['donations'] });
  };

  const isPending =
    createDonation.isPending || updateDonation.isPending || deleteDocument.isPending;
  const attachedDocIds = new Set(attachedDocs.map((doc) => doc.id));
  const attachmentCount =
    attachedDocs.filter((doc) => !removedDocumentIds.includes(doc.id)).length +
    newFiles.length +
    newLinks.length +
    selectedExistingDocumentIds.length;
  const attachedItems: FileAttachmentExistingItem[] = attachedDocs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    kind: doc.kind,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    url: doc.url,
    previewUrl:
      doc.kind === 'upload' && doc.mimeType?.startsWith('image/')
        ? documentsApi.getDownloadUrl(doc.id, doc.updatedAt)
        : undefined,
    downloadUrl:
      doc.kind === 'upload' ? documentsApi.getDownloadUrl(doc.id, doc.updatedAt) : undefined,
  }));
  const vehicleDocs = vehicleDocsData?.items ?? [];
  const picker = buildDocumentPickerItems(
    vehicleDocs.filter((doc) => !attachedDocIds.has(doc.id)),
    documentsApi.getDownloadUrl,
  );

  return (
    <Modal
      open={open}
      title={isEdit ? 'Редагувати надходження' : 'Додати надходження'}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={560}
    >
      <Form form={form} layout="vertical" onFinish={onFinish} validateTrigger="onBlur">
        {needsVehiclePick && (
          <Form.Item label="Автомобіль" required>
            <Select
              showSearch
              placeholder="Оберіть автомобіль"
              optionFilterProp="label"
              value={selectedVehicleId}
              onChange={(v: string) => {
                setSelectedVehicleId(v);
                setSelectedExistingDocumentIds([]);
              }}
              onSelect={() => {
                isDonationDateManuallyChangedRef.current = false;
              }}
              options={(vehiclesData?.items ?? []).map((v) => ({
                value: v.id,
                label: `${v.identifier} — ${v.brand} ${v.model}`,
              }))}
            />
          </Form.Item>
        )}

        <Form.Item
          name="donationDate"
          label="Дата надходження"
          rules={[{ required: true, message: 'Оберіть дату' }]}
        >
          <DatePicker
            style={{ width: '100%' }}
            format="DD.MM.YYYY"
            onChange={(date) => {
              if (date) {
                isDonationDateManuallyChangedRef.current = true;
                setDonationDate(date.format('YYYY-MM-DD'));
              }
            }}
          />
        </Form.Item>

        <MoneyFields
          form={form}
          currency={currency}
          rate={rate}
          amount={amount}
          rateSource={rateSource}
          date={donationDate}
          isEdit={isEdit}
          onCurrencyChange={setCurrency}
          onRateChange={setRate}
          onRateSourceChange={setRateSource}
          onAmountChange={setAmount}
        />

        <Form.Item name="categoryId" label="Категорія">
          <Select
            allowClear
            placeholder="Оберіть категорію"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Form.Item>

        <Form.Item
          name="donorId"
          label="Донор"
          rules={[{ required: true, message: 'Оберіть донора' }]}
        >
          <DonorPicker />
        </Form.Item>

        <Form.Item name="description" label="Опис">
          <Input.TextArea rows={3} maxLength={2000} showCount />
        </Form.Item>

        <Form.Item label="Документи до надходження">
          <FileAttachmentField
            allowLinks
            acceptedMimeTypes={ALLOWED_MIME_TYPES}
            existingItems={isEdit ? attachedItems : []}
            loading={attachedDocsLoading || vehicleDocsLoading}
            maxSizeBytes={MAX_SIZE_BYTES}
            newFiles={newFiles}
            onNewFilesChange={setNewFiles}
            newLinks={newLinks}
            onNewLinksChange={setNewLinks}
            removedExistingIds={removedDocumentIds}
            onRemovedExistingIdsChange={setRemovedDocumentIds}
            selectableExistingItems={picker.items}
            selectedExistingIds={selectedExistingDocumentIds}
            onSelectedExistingIdsChange={setSelectedExistingDocumentIds}
            selectExistingPlaceholder="Вибрати існуючі документи авто"
          />
          {attachmentCount > 1 && (
            <GroupingToggle
              mode="locked"
              checked
              name={groupName}
              onNameChange={setGroupName}
              namePlaceholder="Назва групи документів (необовʼязково)"
            />
          )}
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={onClose}>Скасувати</Button>
            <Button type="primary" htmlType="submit" loading={isPending}>
              {isEdit ? 'Зберегти' : 'Додати'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
