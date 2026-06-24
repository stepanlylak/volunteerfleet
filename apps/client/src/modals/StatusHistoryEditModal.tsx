import { Button, Card, DatePicker, Form, Input, Modal, Space, Switch, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import type { DocumentResponse, VehicleStatus, VehicleStatusHistory } from '@volunteerfleet/shared';
import { VEHICLE_STATUS_CONFIG } from '@volunteerfleet/shared';
import {
  type FileAttachmentExistingItem,
  type FileAttachmentNewFile,
  type FileAttachmentNewLink,
  FileAttachmentField,
} from '../components/files/FileAttachmentField';
import { GroupingToggle } from '../components/files/GroupingToggle';
import { useVehicleDocuments } from '../hooks/useDocuments';
import { useUpdateStatusHistory } from '../hooks/useVehicles';
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
  currentGroupId: string | null;
}

function getSlotsForStatus(status: VehicleStatus, entry: VehicleStatusHistory): DocSlot[] {
  switch (status) {
    case 'paid':
      return [
        {
          fieldKey: 'registrationGroupId',
          label: 'Техпаспорт без печатки митниці',
          currentGroupId: entry.registrationGroupId ?? null,
        },
      ];
    case 'in_transit':
      return [
        {
          fieldKey: 'customsDeclarationGroupId',
          label: 'Митна декларація',
          currentGroupId: entry.customsDeclarationGroupId ?? null,
        },
      ];
    case 'arrived':
      return [
        {
          fieldKey: 'stampedRegistrationGroupId',
          label: 'Техпаспорт з печаткою митниці',
          currentGroupId: entry.stampedRegistrationGroupId ?? null,
        },
        {
          fieldKey: 'stampedCustomsDeclarationGroupId',
          label: 'Скан митної декларації з печатками',
          currentGroupId: entry.stampedCustomsDeclarationGroupId ?? null,
        },
      ];
    case 'ready':
      return [
        {
          fieldKey: 'transferActDraftGroupId',
          label: 'Акт приймання-передачі (чернетка)',
          currentGroupId: entry.transferActDraftGroupId ?? null,
        },
      ];
    case 'transferred':
      return [
        {
          fieldKey: 'transferActSignedGroupId',
          label: 'Підписаний акт приймання-передачі',
          currentGroupId: entry.transferActSignedGroupId ?? null,
        },
      ];
    case 'returned':
      return [
        {
          fieldKey: 'returnActGroupId',
          label: 'Акт повернення',
          currentGroupId: entry.returnActGroupId ?? null,
        },
      ];
    default:
      return [];
  }
}

// Customs-related document slots, irrelevant for local purchases (no border crossing).
const CUSTOMS_DOC_SLOT_KEYS = [
  'stampedRegistrationGroupId',
  'customsDeclarationGroupId',
  'stampedCustomsDeclarationGroupId',
];

interface SlotState {
  newFiles: FileAttachmentNewFile[];
  newLinks: FileAttachmentNewLink[];
  existingIds: string[];
  currentGroupId: string | null;
  removedIds: string[];
  groupName?: string;
}

interface FormValues {
  transitionDate: dayjs.Dayjs;
  note?: string;
  isLocalPurchase?: boolean;
  borderCrossingDate?: dayjs.Dayjs | null;
  isRegisteredAtServiceCenter?: boolean;
}

interface StatusHistoryEditModalProps {
  open: boolean;
  vehicleId: string;
  entry: VehicleStatusHistory;
  // Local purchase is decided on the `paid` entry; passed down so customs slots
  // can be hidden when editing the related `arrived`/`in_transit` entries.
  isLocalPurchase?: boolean;
  onClose: () => void;
}

export function StatusHistoryEditModal({
  open,
  vehicleId,
  entry,
  isLocalPurchase = false,
  onClose,
}: StatusHistoryEditModalProps) {
  const [form] = Form.useForm<FormValues>();
  const status = entry.newStatus;
  const docSlots = getSlotsForStatus(status, entry).filter(
    (slot) => !(isLocalPurchase && CUSTOMS_DOC_SLOT_KEYS.includes(slot.fieldKey)),
  );

  const [slotStates, setSlotStates] = useState<Record<string, SlotState>>({});
  const [submitting, setSubmitting] = useState(false);

  const updateHistory = useUpdateStatusHistory(vehicleId);
  const { data: vehicleDocsData } = useVehicleDocuments(open ? vehicleId : undefined, {
    pageSize: 100,
    excludeStatusBound: true,
  });
  const vehicleDocs = vehicleDocsData?.items ?? [];
  const picker = buildDocumentPickerItems(vehicleDocs, documentsApi.getDownloadUrl);
  // Full document list (status-bound included) so each slot's already-attached
  // files can be shown and removed — the picker query excludes them.
  const { data: allDocsData, isLoading: allDocsLoading } = useVehicleDocuments(
    open ? vehicleId : undefined,
    { pageSize: 100 },
  );
  const allDocs = allDocsData?.items ?? [];
  const slotExistingItems = (groupId: string | null): FileAttachmentExistingItem[] =>
    groupId ? allDocs.filter((d) => d.groupId === groupId).map(toAttachmentItem) : [];

  useEffect(() => {
    if (!open) return;
    const initial: Record<string, SlotState> = {};
    for (const slot of getSlotsForStatus(status, entry)) {
      initial[slot.fieldKey] = {
        newFiles: [],
        newLinks: [],
        existingIds: [],
        currentGroupId: slot.currentGroupId,
        removedIds: [],
      };
    }
    setSlotStates(initial);
    form.setFieldsValue({
      transitionDate: dayjs(entry.transitionDate),
      note: entry.note ?? undefined,
      isLocalPurchase: entry.isLocalPurchase ?? false,
      borderCrossingDate: entry.borderCrossingDate ? dayjs(entry.borderCrossingDate) : null,
      isRegisteredAtServiceCenter: entry.isRegisteredAtServiceCenter ?? false,
    });
  }, [open, entry, form, status]);

  const getSlotState = (key: string): SlotState =>
    slotStates[key] ?? {
      newFiles: [],
      newLinks: [],
      existingIds: [],
      currentGroupId: null,
      removedIds: [],
    };

  const setSlotField = (key: string, patch: Partial<SlotState>) => {
    setSlotStates((prev) => {
      const current = prev[key] ?? {
        newFiles: [],
        newLinks: [],
        existingIds: [],
        currentGroupId: null,
        removedIds: [],
      };
      return { ...prev, [key]: { ...current, ...patch } };
    });
  };

  const selectedDocIds = (existingIds: string[]): string[] =>
    existingIds.flatMap((id) => picker.docIdsById[id] ?? []);

  const buildSlotGroup = (slot: DocSlot, state: SlotState): Promise<string | null> =>
    buildDocumentGroup({
      vehicleId,
      name: state.groupName?.trim() || slot.label,
      existingGroupId: state.currentGroupId,
      newFiles: state.newFiles,
      newLinks: state.newLinks,
      selectedExisting: selectedDocIds(state.existingIds).map((docId) => {
        const doc = vehicleDocs.find((d) => d.id === docId);
        return { id: docId, name: doc?.name ?? '', groupId: doc?.groupId ?? null };
      }),
    });

  const onFinish = async (values: FormValues) => {
    const transitionDate = values.transitionDate.format('YYYY-MM-DD');
    setSubmitting(true);
    try {
      const groupIds: Record<string, string | null> = {};
      for (const slot of docSlots) {
        const state = getSlotState(slot.fieldKey);
        for (const docId of state.removedIds) {
          try {
            await documentsApi.remove(docId);
          } catch (err) {
            // A 404 means the document is already gone (e.g. stale list, retried
            // save) — the desired end state is reached, so keep going.
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status !== 404) throw err;
          }
        }
        const remainingExisting = slotExistingItems(state.currentGroupId).filter(
          (item) => !state.removedIds.includes(item.id),
        ).length;
        const hasNewContent =
          state.newFiles.length > 0 ||
          state.newLinks.length > 0 ||
          selectedDocIds(state.existingIds).length > 0;
        // Detach the group only when the user actually removed the slot's documents
        // and added nothing back, so the entry no longer references an empty group
        // (the backend rejects those) and the "missing document" alert can surface.
        // The `removedIds` guard is essential: without it a slow or incomplete
        // `allDocs` read (still loading, or the group beyond `pageSize`) would make
        // an untouched slot look empty and silently drop its group on a plain save.
        const userEmptiedSlot =
          state.removedIds.length > 0 && remainingExisting === 0 && !hasNewContent;
        groupIds[slot.fieldKey] = userEmptiedSlot ? null : await buildSlotGroup(slot, state);
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
          payload = { ...base };
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
    } catch (err) {
      if (err instanceof Error && err.message === MOVE_CANCELLED) return;
      message.error('Помилка при збереженні');
    } finally {
      setSubmitting(false);
    }
  };

  const isPending = updateHistory.isPending || submitting;
  // Block saving until the current documents of group-bound slots have loaded, so a
  // save can never run against a partial existing-docs read (see the detach guard).
  const waitingForExistingDocs = allDocsLoading && docSlots.some((slot) => slot.currentGroupId);

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

        {status === 'arrived' && !isLocalPurchase && (
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
                loading={state.currentGroupId ? allDocsLoading : false}
                existingItems={slotExistingItems(state.currentGroupId)}
                removedExistingIds={state.removedIds}
                onRemovedExistingIdsChange={(ids) =>
                  setSlotField(slot.fieldKey, { removedIds: ids })
                }
                newFiles={state.newFiles}
                onNewFilesChange={(files) => {
                  setSlotStates((prev) => {
                    const current = prev[slot.fieldKey] ?? {
                      newFiles: [],
                      newLinks: [],
                      existingIds: [],
                      currentGroupId: null,
                      removedIds: [],
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
              {!state.currentGroupId && itemCount > 1 && (
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
            <Button
              type="primary"
              htmlType="submit"
              loading={isPending}
              disabled={waitingForExistingDocs}
            >
              Зберегти
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

function toAttachmentItem(document: DocumentResponse): FileAttachmentExistingItem {
  return {
    id: document.id,
    name: document.name,
    kind: document.kind,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    url: document.url,
    previewUrl:
      document.kind === 'upload' && document.mimeType?.startsWith('image/')
        ? documentsApi.getDownloadUrl(document.id, document.updatedAt)
        : undefined,
    downloadUrl:
      document.kind === 'upload'
        ? documentsApi.getDownloadUrl(document.id, document.updatedAt)
        : undefined,
  };
}
