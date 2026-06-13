import { Button, Card, DatePicker, Form, Input, Modal, Select, Space, Switch, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import type { VehicleResponse, VehicleStatus, VehicleStatusHistory } from '@volunteerfleet/shared';
import { ALLOWED_TRANSITIONS, VEHICLE_STATUS_CONFIG } from '@volunteerfleet/shared';
import {
  type FileAttachmentNewFile,
  type FileAttachmentNewLink,
  FileAttachmentField,
} from '../components/files/FileAttachmentField';
import { GroupingToggle } from '../components/files/GroupingToggle';
import { useVehicleDocuments } from '../hooks/useDocuments';
import { useVehicleTransition } from '../hooks/useVehicles';
import { documentsApi } from '../api/documents.api';
import { buildDocumentGroup, MOVE_CANCELLED } from '../utils/buildDocumentGroup';
import { buildDocumentPickerItems } from '../utils/documentPickerItems';

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
}

const TRANSITION_DOC_SLOTS: Partial<Record<VehicleStatus, DocSlot[]>> = {
  paid: [{ fieldKey: 'registrationGroupId', label: 'Техпаспорт без печатки митниці' }],
  in_transit: [{ fieldKey: 'customsDeclarationGroupId', label: 'Митна декларація' }],
  arrived: [
    { fieldKey: 'stampedRegistrationGroupId', label: 'Техпаспорт з печаткою митниці' },
    { fieldKey: 'stampedCustomsDeclarationGroupId', label: 'Скан митної декларації з печатками' },
  ],
  ready: [{ fieldKey: 'transferActDraftGroupId', label: 'Акт приймання-передачі (чернетка)' }],
  transferred: [
    { fieldKey: 'transferActSignedGroupId', label: 'Підписаний акт приймання-передачі' },
  ],
  returned: [{ fieldKey: 'returnActGroupId', label: 'Акт повернення' }],
};

interface SlotState {
  newFiles: FileAttachmentNewFile[];
  newLinks: FileAttachmentNewLink[];
  existingIds: string[];
  groupName?: string;
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
  onPaidTransition?: (transitionDate: string) => void;
}

export function StatusTransitionModal({
  open,
  vehicle,
  lastHistoryEntry,
  onClose,
  onPaidTransition,
}: StatusTransitionModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [targetStatus, setTargetStatus] = useState<VehicleStatus | undefined>();
  const [slotStates, setSlotStates] = useState<Record<string, SlotState>>({});
  const [submitting, setSubmitting] = useState(false);
  const isDateManuallyChangedRef = useRef(false);

  const allowedTargets = ALLOWED_TRANSITIONS[vehicle.status] ?? [];
  const docSlots = targetStatus ? (TRANSITION_DOC_SLOTS[targetStatus] ?? []) : [];

  const defaultTransitionDate =
    lastHistoryEntry?.transitionDate ?? vehicle.startDate ?? dayjs().format('YYYY-MM-DD');

  const transition = useVehicleTransition(vehicle.id);
  // Documents that are already status evidence are excluded from the picker so
  // they cannot be stolen by a move (backend enforces the same guard).
  const { data: vehicleDocsData } = useVehicleDocuments(open ? vehicle.id : undefined, {
    pageSize: 100,
    excludeStatusBound: true,
  });

  const vehicleDocs = vehicleDocsData?.items ?? [];
  // Picker offers logical documents (groups) of the vehicle; selecting any
  // merges its files into the slot's new group.
  const picker = buildDocumentPickerItems(vehicleDocs, documentsApi.getDownloadUrl);

  useEffect(() => {
    if (!open) return;
    setTargetStatus(undefined);
    setSlotStates({});
    isDateManuallyChangedRef.current = false;
    form.resetFields();
    form.setFieldsValue({
      transitionDate: dayjs(defaultTransitionDate),
      isLocalPurchase: false,
      isRegisteredAtServiceCenter: false,
    });
  }, [open, form, defaultTransitionDate]);

  useEffect(() => {
    if (!open || isDateManuallyChangedRef.current) return;
    form.setFieldValue('transitionDate', dayjs(defaultTransitionDate));
  }, [open, form, defaultTransitionDate]);

  const getSlotState = (key: string): SlotState =>
    slotStates[key] ?? { newFiles: [], newLinks: [], existingIds: [] };

  const setSlotField = (key: string, patch: Partial<SlotState>) => {
    setSlotStates((prev) => {
      const current = prev[key] ?? { newFiles: [], newLinks: [], existingIds: [] };
      return { ...prev, [key]: { ...current, ...patch } };
    });
  };

  const selectedDocIds = (existingIds: string[]): string[] =>
    existingIds.flatMap((id) => picker.docIdsById[id] ?? []);

  const buildSlotGroup = (slot: DocSlot, state: SlotState): Promise<string | null> =>
    buildDocumentGroup({
      vehicleId: vehicle.id,
      name: state.groupName?.trim() || slot.label,
      newFiles: state.newFiles,
      newLinks: state.newLinks,
      selectedExisting: selectedDocIds(state.existingIds).map((docId) => {
        const doc = vehicleDocs.find((d) => d.id === docId);
        return { id: docId, name: doc?.name ?? '', groupId: doc?.groupId ?? null };
      }),
    });

  const onFinish = async (values: FormValues) => {
    if (!values.targetStatus) {
      message.error('Оберіть новий статус');
      return;
    }

    const transitionDate = values.transitionDate.format('YYYY-MM-DD');

    setSubmitting(true);
    try {
      const groupIds: Record<string, string | null> = {};
      for (const slot of docSlots) {
        groupIds[slot.fieldKey] = await buildSlotGroup(slot, getSlotState(slot.fieldKey));
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
            isLocalPurchase: values.isLocalPurchase ?? false,
            registrationGroupId: groupIds['registrationGroupId'] ?? null,
          };
          break;
        case 'in_transit':
          payload = {
            ...base,
            customsDeclarationGroupId: groupIds['customsDeclarationGroupId'] ?? null,
          };
          break;
        case 'arrived':
          payload = {
            ...base,
            borderCrossingDate: values.borderCrossingDate
              ? values.borderCrossingDate.format('YYYY-MM-DD')
              : null,
            stampedRegistrationGroupId: groupIds['stampedRegistrationGroupId'] ?? null,
            stampedCustomsDeclarationGroupId: groupIds['stampedCustomsDeclarationGroupId'] ?? null,
          };
          break;
        case 'in_repair':
          payload = { ...base };
          break;
        case 'ready':
          payload = {
            ...base,
            transferActDraftGroupId: groupIds['transferActDraftGroupId'] ?? null,
          };
          break;
        case 'transferred':
          payload = {
            ...base,
            transferActSignedGroupId: groupIds['transferActSignedGroupId'] ?? null,
            isRegisteredAtServiceCenter: values.isRegisteredAtServiceCenter ?? false,
          };
          break;
        case 'returned':
          payload = { ...base, returnActGroupId: groupIds['returnActGroupId'] ?? null };
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
      if (values.targetStatus === 'paid') {
        onPaidTransition?.(transitionDate);
      }
      onClose();
    } catch (err) {
      if (err instanceof Error && err.message === MOVE_CANCELLED) return;
      message.error('Помилка при зміні статусу');
    } finally {
      setSubmitting(false);
    }
  };

  const isPending = transition.isPending || submitting;

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
              }
            }}
          />
        </Form.Item>

        {targetStatus === 'paid' && (
          <Form.Item name="isLocalPurchase" label="Місцева покупка" valuePropName="checked">
            <Switch />
          </Form.Item>
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
          const itemCount =
            state.newFiles.length +
            state.newLinks.length +
            selectedDocIds(state.existingIds).length;
          return (
            <Card key={slot.fieldKey} size="small" title={slot.label} style={{ marginBottom: 16 }}>
              <FileAttachmentField
                multiple
                allowLinks
                acceptedMimeTypes={ALLOWED_MIME_TYPES}
                maxSizeBytes={MAX_SIZE_BYTES}
                newFiles={state.newFiles}
                onNewFilesChange={(files) => {
                  setSlotStates((prev) => {
                    const current = prev[slot.fieldKey] ?? {
                      newFiles: [],
                      newLinks: [],
                      existingIds: [],
                    };
                    return {
                      ...prev,
                      [slot.fieldKey]: {
                        ...current,
                        newFiles: typeof files === 'function' ? files(current.newFiles) : files,
                      },
                    };
                  });
                }}
                newLinks={state.newLinks}
                onNewLinksChange={(links) => setSlotField(slot.fieldKey, { newLinks: links })}
                selectableExistingItems={picker.items}
                selectedExistingIds={state.existingIds}
                onSelectedExistingIdsChange={(ids) => {
                  const patch: Partial<SlotState> = { existingIds: ids };
                  if (!state.groupName && ids[0]) {
                    patch.groupName = picker.nameById[ids[0]] ?? '';
                  }
                  setSlotField(slot.fieldKey, patch);
                }}
                selectExistingPlaceholder="Вибрати наявні документи / групи"
              />
              {itemCount > 1 && (
                <div style={{ marginTop: 8 }}>
                  <GroupingToggle
                    mode="locked"
                    checked
                    name={state.groupName ?? ''}
                    onNameChange={(name) => setSlotField(slot.fieldKey, { groupName: name })}
                    namePlaceholder={slot.label}
                  />
                </div>
              )}
            </Card>
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
