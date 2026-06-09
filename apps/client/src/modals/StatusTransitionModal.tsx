import { Button, DatePicker, Form, Input, Modal, Select, Space, Switch, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import type {
  Currency,
  VehicleResponse,
  VehicleStatus,
  VehicleStatusHistory,
} from '@volunteerfleet/shared';
import { ALLOWED_TRANSITIONS, VEHICLE_STATUS_CONFIG } from '@volunteerfleet/shared';
import { AmountCurrencyRateField } from '../components/AmountCurrencyRateField';
import {
  type FileAttachmentExistingItem,
  type FileAttachmentNewFile,
  type FileAttachmentNewLink,
  FileAttachmentField,
} from '../components/files/FileAttachmentField';
import { useLinkDocument, useUploadDocument, useVehicleDocuments } from '../hooks/useDocuments';
import { useVehicleTransition } from '../hooks/useVehicles';
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
}

const TRANSITION_DOC_SLOTS: Partial<Record<VehicleStatus, DocSlot[]>> = {
  paid: [
    {
      fieldKey: 'registrationDocId',
      label: 'Техпаспорт без печатки митниці',
      documentType: 'registration_certificate',
    },
  ],
  in_transit: [
    {
      fieldKey: 'customsDeclarationDocId',
      label: 'Митна декларація',
      documentType: 'customs_declaration',
    },
  ],
  arrived: [
    {
      fieldKey: 'stampedRegistrationDocId',
      label: 'Техпаспорт з печаткою митниці',
      documentType: 'registration_certificate',
    },
    {
      fieldKey: 'stampedCustomsDeclarationDocId',
      label: 'Скан митної декларації з печатками',
      documentType: 'stamped_customs_declaration',
    },
  ],
  ready: [
    {
      fieldKey: 'transferActDraftDocId',
      label: 'Акт приймання-передачі (чернетка)',
      documentType: 'transfer_act_draft',
    },
  ],
  transferred: [
    {
      fieldKey: 'transferActSignedDocId',
      label: 'Підписаний акт приймання-передачі',
      documentType: 'transfer_act_signed',
    },
  ],
  returned: [{ fieldKey: 'returnActDocId', label: 'Акт повернення', documentType: 'return_act' }],
};

interface SlotState {
  newFiles: FileAttachmentNewFile[];
  newLinks: FileAttachmentNewLink[];
  existingDocId: string | null;
}

interface FormValues {
  targetStatus: VehicleStatus;
  transitionDate: dayjs.Dayjs;
  note?: string;
  // paid
  isLocalPurchase?: boolean;
  // arrived
  borderCrossingDate?: dayjs.Dayjs;
  // in_repair
  // transferred
  isRegisteredAtServiceCenter?: boolean;
  // lost
  lostReason?: string;
}

interface StatusTransitionModalProps {
  open: boolean;
  vehicle: VehicleResponse;
  lastHistoryEntry?: VehicleStatusHistory;
  onClose: () => void;
}

export function StatusTransitionModal({
  open,
  vehicle,
  lastHistoryEntry,
  onClose,
}: StatusTransitionModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [targetStatus, setTargetStatus] = useState<VehicleStatus | undefined>();
  const [currency, setCurrency] = useState<Currency>('UAH');
  const [rate, setRate] = useState<number>(1);
  const [amount, setAmount] = useState<number>(0);
  const [rateSource, setRateSource] = useState<'default' | 'manual'>('default');
  const [transitionDateStr, setTransitionDateStr] = useState<string | undefined>();
  const [slotStates, setSlotStates] = useState<Record<string, SlotState>>({});
  const isDateManuallyChangedRef = useRef(false);

  const allowedTargets = ALLOWED_TRANSITIONS[vehicle.status] ?? [];
  const docSlots = targetStatus ? (TRANSITION_DOC_SLOTS[targetStatus] ?? []) : [];

  const defaultTransitionDate =
    lastHistoryEntry?.transitionDate ?? vehicle.startDate ?? dayjs().format('YYYY-MM-DD');

  const transition = useVehicleTransition(vehicle.id);
  const uploadDocument = useUploadDocument(vehicle.id);
  const linkDocument = useLinkDocument(vehicle.id);
  const { data: vehicleDocsData } = useVehicleDocuments(open ? vehicle.id : undefined, {
    pageSize: 100,
  });

  const vehicleDocs = vehicleDocsData?.items ?? [];

  useEffect(() => {
    if (!open) return;
    setTargetStatus(undefined);
    setCurrency('UAH');
    setRate(1);
    setAmount(0);
    setRateSource('default');
    setSlotStates({});
    isDateManuallyChangedRef.current = false;
    form.resetFields();
    form.setFieldsValue({
      transitionDate: dayjs(defaultTransitionDate),
      isLocalPurchase: false,
      isRegisteredAtServiceCenter: false,
    });
    setTransitionDateStr(defaultTransitionDate);
  }, [open, form, defaultTransitionDate]);

  useEffect(() => {
    if (!open || isDateManuallyChangedRef.current) return;
    form.setFieldValue('transitionDate', dayjs(defaultTransitionDate));
    setTransitionDateStr(defaultTransitionDate);
  }, [open, form, defaultTransitionDate]);

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
      formData.append('vehicleId', vehicle.id);
      formData.append('documentType', slot.documentType);
      const doc = await uploadDocument.mutateAsync(formData);
      return doc.id;
    }

    if (link) {
      const doc = await linkDocument.mutateAsync({
        name: link.name,
        url: link.url,
        documentType: slot.documentType,
        vehicleId: vehicle.id,
      });
      return doc.id;
    }

    if (state.existingDocId) return state.existingDocId;

    return null;
  };

  const onFinish = async (values: FormValues) => {
    if (!values.targetStatus) {
      message.error('Оберіть новий статус');
      return;
    }

    const transitionDate = values.transitionDate.format('YYYY-MM-DD');

    try {
      const docIds: Record<string, string | null> = {};
      for (const slot of docSlots) {
        const state = getSlotState(slot.fieldKey);
        docIds[slot.fieldKey] = await uploadOrLinkDoc(slot, state);
      }

      const base = {
        expectedCurrentStatus: vehicle.status,
        targetStatus: values.targetStatus,
        transitionDate,
        note: values.note || null,
      };

      let payload;
      switch (values.targetStatus) {
        case 'paid':
          payload = {
            ...base,
            purchasePrice: amount,
            purchaseCurrency: currency,
            purchaseRate: rate,
            purchaseRateSource: rateSource,
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

      await transition.mutateAsync(payload as Parameters<typeof transition.mutateAsync>[0]);
      message.success('Статус змінено');
      onClose();
    } catch {
      message.error('Помилка при зміні статусу');
    }
  };

  const isPending = transition.isPending || uploadDocument.isPending || linkDocument.isPending;

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

  return (
    <Modal
      open={open}
      title="Змінити статус авто"
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={560}
    >
      <Form form={form} layout="vertical" onFinish={onFinish} validateTrigger="onBlur">
        <Form.Item
          name="targetStatus"
          label="Новий статус"
          rules={[{ required: true, message: 'Оберіть новий статус' }]}
        >
          <Select
            placeholder="Оберіть статус"
            options={allowedTargets.map((s) => ({
              value: s,
              label: VEHICLE_STATUS_CONFIG[s].label,
            }))}
            onChange={(v: VehicleStatus) => {
              setTargetStatus(v);
              setSlotStates({});
              setCurrency('UAH');
              setRate(1);
              setAmount(0);
              setRateSource('default');
            }}
          />
        </Form.Item>

        <Form.Item
          name="transitionDate"
          label="Дата переходу"
          rules={[{ required: true, message: 'Оберіть дату' }]}
        >
          <DatePicker
            style={{ width: '100%' }}
            format="DD.MM.YYYY"
            onChange={(date) => {
              if (date) {
                isDateManuallyChangedRef.current = true;
                setTransitionDateStr(date.format('YYYY-MM-DD'));
              }
            }}
          />
        </Form.Item>

        {targetStatus === 'paid' && (
          <>
            <AmountCurrencyRateField
              form={form}
              amountFieldName="purchasePrice"
              currencyFieldName="purchaseCurrency"
              rateFieldName="purchaseRate"
              currency={currency}
              rate={rate}
              amount={amount}
              rateSource={rateSource}
              date={transitionDateStr}
              onCurrencyChange={setCurrency}
              onRateChange={setRate}
              onRateSourceChange={setRateSource}
              onAmountChange={setAmount}
            />
            <Form.Item name="isLocalPurchase" label="Місцева покупка" valuePropName="checked">
              <Switch />
            </Form.Item>
          </>
        )}

        {targetStatus === 'arrived' && (
          <Form.Item name="borderCrossingDate" label="Дата перетину кордону">
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
        )}

        {targetStatus === 'transferred' && (
          <Form.Item
            name="isRegisteredAtServiceCenter"
            label="Зареєстровано в сервісному центрі"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        )}

        {targetStatus === 'lost' && (
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
              Змінити статус
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
