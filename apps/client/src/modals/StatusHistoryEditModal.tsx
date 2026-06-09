import { Button, DatePicker, Form, Input, Modal, Space, Switch, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import type { VehicleStatus, VehicleStatusHistory } from '@volunteerfleet/shared';
import { VEHICLE_STATUS_CONFIG } from '@volunteerfleet/shared';
import {
  type FileAttachmentExistingItem,
  type FileAttachmentNewFile,
  type FileAttachmentNewLink,
  FileAttachmentField,
} from '../components/files/FileAttachmentField';
import { useLinkDocument, useUploadDocument, useVehicleDocuments } from '../hooks/useDocuments';
import { useUpdateStatusHistory } from '../hooks/useVehicles';
import { documentsApi } from '../api/documents.api';
import type { DocumentType } from '@volunteerfleet/shared';

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

interface DocSlot {
  fieldKey: string;
  label: string;
  documentType: DocumentType;
  currentDocId: string | null;
}

function getSlotsForStatus(status: VehicleStatus, entry: VehicleStatusHistory): DocSlot[] {
  switch (status) {
    case 'paid':
      return [
        {
          fieldKey: 'registrationDocId',
          label: 'Техпаспорт без печатки митниці',
          documentType: 'registration_certificate',
          currentDocId: entry.registrationDocId ?? null,
        },
      ];
    case 'in_transit':
      return [
        {
          fieldKey: 'customsDeclarationDocId',
          label: 'Митна декларація',
          documentType: 'customs_declaration',
          currentDocId: entry.customsDeclarationDocId ?? null,
        },
      ];
    case 'arrived':
      return [
        {
          fieldKey: 'stampedRegistrationDocId',
          label: 'Техпаспорт з печаткою митниці',
          documentType: 'registration_certificate',
          currentDocId: entry.stampedRegistrationDocId ?? null,
        },
        {
          fieldKey: 'stampedCustomsDeclarationDocId',
          label: 'Скан митної декларації з печатками',
          documentType: 'stamped_customs_declaration',
          currentDocId: entry.stampedCustomsDeclarationDocId ?? null,
        },
      ];
    case 'ready':
      return [
        {
          fieldKey: 'transferActDraftDocId',
          label: 'Акт приймання-передачі (чернетка)',
          documentType: 'transfer_act_draft',
          currentDocId: entry.transferActDraftDocId ?? null,
        },
      ];
    case 'transferred':
      return [
        {
          fieldKey: 'transferActSignedDocId',
          label: 'Підписаний акт приймання-передачі',
          documentType: 'transfer_act_signed',
          currentDocId: entry.transferActSignedDocId ?? null,
        },
      ];
    case 'returned':
      return [
        {
          fieldKey: 'returnActDocId',
          label: 'Акт повернення',
          documentType: 'return_act',
          currentDocId: entry.returnActDocId ?? null,
        },
      ];
    default:
      return [];
  }
}

interface SlotState {
  newFiles: FileAttachmentNewFile[];
  newLinks: FileAttachmentNewLink[];
  existingDocId: string | null;
}

interface FormValues {
  transitionDate: dayjs.Dayjs;
  note?: string;
  isLocalPurchase?: boolean;
  borderCrossingDate?: dayjs.Dayjs | null;
  isRegisteredAtServiceCenter?: boolean;
  lostReason?: string;
}

interface StatusHistoryEditModalProps {
  open: boolean;
  vehicleId: string;
  entry: VehicleStatusHistory;
  onClose: () => void;
}

export function StatusHistoryEditModal({
  open,
  vehicleId,
  entry,
  onClose,
}: StatusHistoryEditModalProps) {
  const [form] = Form.useForm<FormValues>();
  const status = entry.newStatus;
  const docSlots = getSlotsForStatus(status, entry);

  const [slotStates, setSlotStates] = useState<Record<string, SlotState>>({});

  const updateHistory = useUpdateStatusHistory(vehicleId);
  const uploadDocument = useUploadDocument(vehicleId);
  const linkDocument = useLinkDocument(vehicleId);
  const { data: vehicleDocsData } = useVehicleDocuments(open ? vehicleId : undefined, {
    pageSize: 100,
  });
  const vehicleDocs = vehicleDocsData?.items ?? [];

  useEffect(() => {
    if (!open) return;
    const initial: Record<string, SlotState> = {};
    for (const slot of getSlotsForStatus(status, entry)) {
      initial[slot.fieldKey] = {
        newFiles: [],
        newLinks: [],
        existingDocId: slot.currentDocId,
      };
    }
    setSlotStates(initial);
    form.setFieldsValue({
      transitionDate: dayjs(entry.transitionDate),
      note: entry.note ?? undefined,
      isLocalPurchase: entry.isLocalPurchase ?? false,
      borderCrossingDate: null,
      isRegisteredAtServiceCenter: entry.isRegisteredAtServiceCenter ?? false,
      lostReason: entry.lostReason ?? undefined,
    });
  }, [open, entry, form, status]);

  const getSlotState = (key: string): SlotState =>
    slotStates[key] ?? { newFiles: [], newLinks: [], existingDocId: null };

  const setSlotField = (key: string, patch: Partial<SlotState>) => {
    setSlotStates((prev) => ({ ...prev, [key]: { ...getSlotState(key), ...patch } }));
  };

  const uploadOrLinkDoc = async (slot: DocSlot, state: SlotState): Promise<string | null> => {
    const file = state.newFiles[0];
    const link = state.newLinks[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file.file);
      formData.append('name', file.name.trim() || file.file.name);
      formData.append('vehicleId', vehicleId);
      formData.append('documentType', slot.documentType);
      const doc = await uploadDocument.mutateAsync(formData);
      return doc.id;
    }
    if (link) {
      const doc = await linkDocument.mutateAsync({
        name: link.name,
        url: link.url,
        documentType: slot.documentType,
        vehicleId,
      });
      return doc.id;
    }
    if (state.existingDocId) return state.existingDocId;
    return null;
  };

  const onFinish = async (values: FormValues) => {
    const transitionDate = values.transitionDate.format('YYYY-MM-DD');
    try {
      const docIds: Record<string, string | null> = {};
      for (const slot of docSlots) {
        docIds[slot.fieldKey] = await uploadOrLinkDoc(slot, getSlotState(slot.fieldKey));
      }

      const base = {
        targetStatus: status,
        transitionDate,
        note: values.note || null,
      };

      let payload;
      switch (status) {
        case 'paid':
          payload = {
            ...base,
            isLocalPurchase: values.isLocalPurchase ?? false,
            registrationDocId: docIds['registrationDocId'] ?? null,
          };
          break;
        case 'in_transit':
          payload = { ...base, customsDeclarationDocId: docIds['customsDeclarationDocId'] ?? null };
          break;
        case 'arrived':
          payload = {
            ...base,
            borderCrossingDate: values.borderCrossingDate
              ? values.borderCrossingDate.format('YYYY-MM-DD')
              : null,
            stampedRegistrationDocId: docIds['stampedRegistrationDocId'] ?? null,
            stampedCustomsDeclarationDocId: docIds['stampedCustomsDeclarationDocId'] ?? null,
          };
          break;
        case 'in_repair':
          payload = { ...base };
          break;
        case 'ready':
          payload = { ...base, transferActDraftDocId: docIds['transferActDraftDocId'] ?? null };
          break;
        case 'transferred':
          payload = {
            ...base,
            transferActSignedDocId: docIds['transferActSignedDocId'] ?? null,
            isRegisteredAtServiceCenter: values.isRegisteredAtServiceCenter ?? false,
          };
          break;
        case 'returned':
          payload = { ...base, returnActDocId: docIds['returnActDocId'] ?? null };
          break;
        case 'lost':
          payload = { ...base, lostReason: values.lostReason ?? '' };
          break;
        default:
          message.error('Невідомий статус');
          return;
      }

      await updateHistory.mutateAsync({
        historyId: entry.id,
        payload: payload as Parameters<typeof updateHistory.mutateAsync>[0]['payload'],
      });
      message.success('Дані переходу оновлено');
      onClose();
    } catch {
      message.error('Помилка при збереженні');
    }
  };

  const isPending = updateHistory.isPending || uploadDocument.isPending || linkDocument.isPending;

  const selectableDocsForSlot = (slot: DocSlot): FileAttachmentExistingItem[] =>
    vehicleDocs
      .filter((doc) => doc.documentType === slot.documentType)
      .map((doc) => ({
        id: doc.id,
        name: doc.name,
        kind: doc.kind,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        url: doc.url,
        downloadUrl:
          doc.kind === 'upload' ? documentsApi.getDownloadUrl(doc.id, doc.updatedAt) : undefined,
      }));

  const statusConfig = VEHICLE_STATUS_CONFIG[status];

  return (
    <Modal
      open={open}
      title={`Редагувати перехід: ${statusConfig?.label ?? status}`}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={560}
    >
      <Form form={form} layout="vertical" onFinish={onFinish} validateTrigger="onBlur">
        <Form.Item
          name="transitionDate"
          label="Дата переходу"
          rules={[{ required: true, message: 'Оберіть дату' }]}
        >
          <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
        </Form.Item>

        {status === 'paid' && (
          <Form.Item name="isLocalPurchase" label="Місцева покупка" valuePropName="checked">
            <Switch />
          </Form.Item>
        )}

        {status === 'arrived' && (
          <Form.Item name="borderCrossingDate" label="Дата перетину кордону">
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
        )}

        {status === 'transferred' && (
          <Form.Item
            name="isRegisteredAtServiceCenter"
            label="Зареєстровано в сервісному центрі"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        )}

        {status === 'lost' && (
          <Form.Item
            name="lostReason"
            label="Причина втрати"
            rules={[{ required: true, message: 'Вкажіть причину' }]}
          >
            <Input.TextArea rows={3} maxLength={2000} showCount />
          </Form.Item>
        )}

        {docSlots.map((slot) => {
          const state = getSlotState(slot.fieldKey);
          const selectable = selectableDocsForSlot(slot);
          return (
            <Form.Item key={slot.fieldKey} label={slot.label}>
              <FileAttachmentField
                multiple={false}
                allowLinks
                acceptedMimeTypes={ALLOWED_MIME_TYPES}
                maxSizeBytes={MAX_SIZE_BYTES}
                newFiles={state.newFiles}
                onNewFilesChange={(files) =>
                  setSlotField(slot.fieldKey, {
                    newFiles: typeof files === 'function' ? files(state.newFiles) : files,
                  })
                }
                newLinks={state.newLinks}
                onNewLinksChange={(links) => setSlotField(slot.fieldKey, { newLinks: links })}
                selectableExistingItems={selectable}
                selectedExistingIds={state.existingDocId ? [state.existingDocId] : []}
                onSelectedExistingIdsChange={(ids) =>
                  setSlotField(slot.fieldKey, { existingDocId: ids[0] ?? null })
                }
                selectExistingPlaceholder="Вибрати наявний документ"
                hideExistingItemsWhenNewFilesAdded
              />
            </Form.Item>
          );
        })}

        <Form.Item name="note" label="Примітка">
          <Input.TextArea rows={2} maxLength={2000} showCount />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={onClose}>Скасувати</Button>
            <Button type="primary" htmlType="submit" loading={isPending}>
              Зберегти
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
