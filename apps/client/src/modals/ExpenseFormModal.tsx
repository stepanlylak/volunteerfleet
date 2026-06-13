import { Button, DatePicker, Form, Input, Modal, Select, Space, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Currency, ExpenseCreate, ExpenseResponse } from '@volunteerfleet/shared';
import { expenseCreateSchema } from '@volunteerfleet/shared';
import { documentsApi } from '../api/documents.api';
import { documentGroupsApi } from '../api/documentGroups.api';
import {
  FileAttachmentField,
  type FileAttachmentExistingItem,
  type FileAttachmentNewFile,
  type FileAttachmentNewLink,
} from '../components/files/FileAttachmentField';
import { GroupingToggle } from '../components/files/GroupingToggle';
import { useCreateExpense, useUpdateExpense, useVehicleExpenses } from '../hooks/useExpenses';
import { useDeleteDocument, useVehicleDocuments } from '../hooks/useDocuments';
import { useDictionary } from '../hooks/useDictionaries';
import { useVehicles, useVehicleStatusHistory } from '../hooks/useVehicles';
import type { FinancialCategory } from '@volunteerfleet/shared';
import type { DocumentDetachAction } from '../utils/documentDetachConfirm';
import { confirmDocumentDetachAction } from '../utils/documentDetachConfirm';
import { MoneyFields } from '../components/MoneyFields';
import { buildDocumentGroup, MOVE_CANCELLED } from '../utils/buildDocumentGroup';
import { buildDocumentPickerItems } from '../utils/documentPickerItems';

interface ExpenseFormModalProps {
  open: boolean;
  vehicleId?: string;
  vehicleStartDate?: string;
  expense?: ExpenseResponse;
  onClose: () => void;
  onCreated?: (expense: ExpenseResponse) => void;
}

interface FormValues {
  expenseDate: dayjs.Dayjs;
  amount: number;
  currency: Currency;
  rate: number;
  categoryId: string;
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

export function ExpenseFormModal({
  open,
  vehicleId,
  vehicleStartDate,
  expense,
  onClose,
  onCreated,
}: ExpenseFormModalProps) {
  const [form] = Form.useForm<FormValues>();
  const queryClient = useQueryClient();
  const isEdit = !!expense;
  const needsVehiclePick = !vehicleId && !isEdit;

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(vehicleId);
  const effectiveVehicleId = vehicleId ?? expense?.vehicleId ?? selectedVehicleId ?? undefined;
  const { data: vehiclesData } = useVehicles({ pageSize: 100 });

  const [currency, setCurrency] = useState<Currency>('UAH');
  const [expenseDate, setExpenseDate] = useState<string | undefined>();
  const [rateSource, setRateSource] = useState<'default' | 'manual'>('default');
  const [amount, setAmount] = useState<number>(0);
  const [rate, setRate] = useState<number>(1);
  const [newFiles, setNewFiles] = useState<FileAttachmentNewFile[]>([]);
  const [newLinks, setNewLinks] = useState<FileAttachmentNewLink[]>([]);
  const [selectedExistingDocumentIds, setSelectedExistingDocumentIds] = useState<string[]>([]);
  const [removedDocumentIds, setRemovedDocumentIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const isExpenseDateManuallyChangedRef = useRef(false);

  const { data: categoriesData } = useDictionary('financial-categories');
  const categories = (categoriesData ?? []) as FinancialCategory[];
  const selectedVehicle = useMemo(
    () => vehiclesData?.items.find((vehicle) => vehicle.id === effectiveVehicleId),
    [effectiveVehicleId, vehiclesData?.items],
  );
  const { data: latestExpenseData } = useVehicleExpenses(
    !isEdit && effectiveVehicleId ? effectiveVehicleId : undefined,
    { page: 1, pageSize: 1, sort: 'expenseDate:desc' },
  );
  const { data: statusHistoryData } = useVehicleStatusHistory(
    !isEdit && effectiveVehicleId ? effectiveVehicleId : undefined,
  );

  const latestExpenseDate = latestExpenseData?.items[0]?.expenseDate;
  const latestStatusTransitionDate = statusHistoryData?.items[0]?.transitionDate;

  const suggestedExpenseDate =
    latestExpenseDate ??
    (selectedVehicle?.status !== 'new' ? latestStatusTransitionDate : undefined) ??
    selectedVehicle?.startDate ??
    vehicleStartDate ??
    dayjs().format('YYYY-MM-DD');

  const createExpense = useCreateExpense(effectiveVehicleId);
  const updateExpense = useUpdateExpense(effectiveVehicleId);
  const deleteDocument = useDeleteDocument(effectiveVehicleId);
  const { data: attachedDocsData, isLoading: attachedDocsLoading } = useVehicleDocuments(
    expense?.id ? effectiveVehicleId : undefined,
    expense?.id ? { expenseId: expense.id, pageSize: 100 } : undefined,
  );
  const { data: vehicleDocsData, isLoading: vehicleDocsLoading } = useVehicleDocuments(
    effectiveVehicleId,
    { pageSize: 100, excludeStatusBound: true },
  );
  const attachedDocs = expense?.id ? (attachedDocsData?.items ?? []) : [];

  useEffect(() => {
    if (!open) return;
    if (expense) {
      setCurrency(expense.currency);
      setExpenseDate(expense.expenseDate);
      setRateSource(expense.rateSource);
      setAmount(expense.amountMinor / 100);
      setRate(expense.rate);
      setNewFiles([]);
      setNewLinks([]);
      setSelectedExistingDocumentIds([]);
      setRemovedDocumentIds([]);
      setGroupName('');
      isExpenseDateManuallyChangedRef.current = false;
      form.setFieldsValue({
        expenseDate: dayjs(expense.expenseDate),
        amount: expense.amountMinor / 100,
        currency: expense.currency,
        rate: expense.rate,
        categoryId: expense.categoryId,
        description: expense.description ?? undefined,
      });
    } else {
      form.resetFields();
      setSelectedVehicleId(vehicleId);
      setCurrency('UAH');
      setExpenseDate(dayjs().format('YYYY-MM-DD'));
      setRateSource('default');
      setAmount(0);
      setRate(1);
      setNewFiles([]);
      setNewLinks([]);
      setSelectedExistingDocumentIds([]);
      setRemovedDocumentIds([]);
      setGroupName('');
      isExpenseDateManuallyChangedRef.current = false;
      form.setFieldsValue({
        expenseDate: dayjs(),
        currency: 'UAH',
        rate: 1,
      });
    }
  }, [open, expense, form, vehicleId]);

  useEffect(() => {
    if (!open || isEdit || isExpenseDateManuallyChangedRef.current) return;
    setExpenseDate(suggestedExpenseDate);
    form.setFieldValue('expenseDate', dayjs(suggestedExpenseDate));
  }, [form, isEdit, open, suggestedExpenseDate]);

  const onFinish = async (values: FormValues) => {
    if (!effectiveVehicleId) {
      message.error('Оберіть автомобіль');
      return;
    }
    const normalizedExpenseDate = values.expenseDate.format('YYYY-MM-DD');
    const effectiveRate = values.currency === 'UAH' ? 1 : Number(values.rate);
    const payload: ExpenseCreate = {
      vehicleId: effectiveVehicleId,
      expenseDate: normalizedExpenseDate,
      amountMinor: Math.round(Number(values.amount) * 100),
      currency: values.currency,
      rate: effectiveRate,
      categoryId: values.categoryId,
      description: values.description || null,
    };

    const parsed = expenseCreateSchema.safeParse(payload);
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
                'Ви прибрали документи з витрати. Оберіть, видалити їх повністю чи лише відвʼязати від цієї витрати.',
            })
          : null;
      if (removedDocumentIds.length > 0 && !detachAction) return;

      if (isEdit) {
        await updateExpense.mutateAsync({ id: expense.id, payload: parsed.data });
        await syncAttachments(
          expense.id,
          effectiveVehicleId,
          expense.documentGroupId,
          detachAction,
        );
        message.success('Витрату оновлено');
        onClose();
      } else {
        const created = await createExpense.mutateAsync(parsed.data);
        await syncAttachments(
          created.id,
          effectiveVehicleId,
          created.documentGroupId,
          detachAction,
        );
        message.success('Витрату додано');
        onCreated?.(created);
        onClose();
      }
      setNewFiles([]);
      setNewLinks([]);
      setSelectedExistingDocumentIds([]);
      setRemovedDocumentIds([]);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === MOVE_CANCELLED) return;
      message.error('Помилка при збереженні витрати');
    }
  };

  const syncAttachments = async (
    expenseId: string,
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
      expenseId,
      name: groupName.trim() || 'Документи витрати',
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
        const group = await documentGroupsApi.create({
          vehicleId: targetVehicleId,
        });
        try {
          await documentGroupsApi.moveDocument(group.id, documentId);
        } catch (error) {
          await documentGroupsApi.remove(group.id);
          throw error;
        }
      }
    }

    void queryClient.invalidateQueries({ queryKey: ['expenses'] });
  };

  const isPending = createExpense.isPending || updateExpense.isPending || deleteDocument.isPending;
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
      title={isEdit ? 'Редагувати витрату' : 'Додати витрату'}
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
                isExpenseDateManuallyChangedRef.current = false;
              }}
              options={(vehiclesData?.items ?? []).map((v) => ({
                value: v.id,
                label: `${v.identifier} — ${v.brand} ${v.model}`,
              }))}
            />
          </Form.Item>
        )}

        <Form.Item
          name="expenseDate"
          label="Дата витрати"
          rules={[{ required: true, message: 'Оберіть дату' }]}
        >
          <DatePicker
            style={{ width: '100%' }}
            format="DD.MM.YYYY"
            onChange={(date) => {
              if (date) {
                isExpenseDateManuallyChangedRef.current = true;
                setExpenseDate(date.format('YYYY-MM-DD'));
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
          date={expenseDate}
          isEdit={isEdit}
          onCurrencyChange={setCurrency}
          onRateChange={setRate}
          onRateSourceChange={setRateSource}
          onAmountChange={setAmount}
        />

        <Form.Item
          name="categoryId"
          label="Категорія"
          rules={[{ required: true, message: 'Оберіть категорію' }]}
        >
          <Select
            placeholder="Оберіть категорію"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Form.Item>

        <Form.Item name="description" label="Опис">
          <Input.TextArea rows={3} maxLength={2000} showCount />
        </Form.Item>

        <Form.Item label="Документи до витрати">
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

export type { ExpenseFormModalProps };
