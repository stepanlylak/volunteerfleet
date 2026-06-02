import { Button, Modal, Select, Space, message } from 'antd';
import { useEffect, useState } from 'react';
import type { DocumentResponse } from '@volunteerfleet/shared';
import {
  FileAttachmentField,
  type FileAttachmentExistingItem,
  type FileAttachmentNewFile,
  type FileAttachmentNewLink,
} from '../components/files/FileAttachmentField';
import { documentsApi } from '../api/documents.api';
import {
  useLinkDocument,
  useReplaceUploadDocument,
  useUpdateDocument,
  useUploadDocument,
} from '../hooks/useDocuments';
import { useVehicles } from '../hooks/useVehicles';

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

interface DocumentFormModalProps {
  open: boolean;
  vehicleId?: string;
  expenseId?: string;
  document?: DocumentResponse;
  onClose: () => void;
  onCreated?: (doc: DocumentResponse) => void;
  onSaved?: (doc: DocumentResponse) => void;
}

export function DocumentFormModal({
  open,
  vehicleId,
  expenseId,
  document,
  onClose,
  onCreated,
  onSaved,
}: DocumentFormModalProps) {
  const [newFiles, setNewFiles] = useState<FileAttachmentNewFile[]>([]);
  const [newLinks, setNewLinks] = useState<FileAttachmentNewLink[]>([]);
  const [existingItems, setExistingItems] = useState<FileAttachmentExistingItem[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(vehicleId);

  const isEdit = Boolean(document);
  const needsVehiclePick = !vehicleId;
  const effectiveVehicleId = vehicleId ?? document?.vehicleId ?? selectedVehicleId;
  const { data: vehiclesData } = useVehicles({ pageSize: 100 });

  const uploadDoc = useUploadDocument(effectiveVehicleId);
  const linkDoc = useLinkDocument(effectiveVehicleId);
  const updateDoc = useUpdateDocument(effectiveVehicleId);
  const replaceUploadDoc = useReplaceUploadDocument(effectiveVehicleId);

  const isPending =
    uploadDoc.isPending || linkDoc.isPending || updateDoc.isPending || replaceUploadDoc.isPending;

  useEffect(() => {
    if (!open) return;
    setSelectedVehicleId(vehicleId ?? document?.vehicleId ?? undefined);
    setExistingItems(document ? [toAttachmentItem(document)] : []);
    setNewFiles([]);
    setNewLinks([]);
  }, [document, open, vehicleId]);

  const handleClose = () => {
    setNewFiles([]);
    setNewLinks([]);
    setExistingItems([]);
    setSelectedVehicleId(vehicleId ?? document?.vehicleId ?? undefined);
    onClose();
  };

  const handleEditSubmit = async () => {
    if (!document) return;
    const existingItem = existingItems[0];
    const fileItem = newFiles[0];
    const normalizedName = (fileItem?.name ?? existingItem?.name ?? '').trim();
    if (!normalizedName) {
      void message.error('Введіть назву документа');
      return;
    }

    try {
      if (document.kind === 'link') {
        const normalizedUrl = (existingItem?.url ?? '').trim();
        if (!normalizedUrl) {
          void message.error('Введіть посилання');
          return;
        }
        const saved = await updateDoc.mutateAsync({
          id: document.id,
          payload: { name: normalizedName, url: normalizedUrl },
        });
        onSaved?.(saved);
      } else if (fileItem) {
        const formData = new FormData();
        formData.append('file', fileItem.file);
        formData.append('name', normalizedName || fileItem.file.name);
        const saved = await replaceUploadDoc.mutateAsync({ id: document.id, formData });
        onSaved?.(saved);
      } else {
        const saved = await updateDoc.mutateAsync({
          id: document.id,
          payload: { name: normalizedName },
        });
        onSaved?.(saved);
      }

      void message.success('Документ оновлено');
      handleClose();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 413) void message.error('Файл надто великий');
      else if (status === 415) void message.error('Тип файлу не підтримується');
      else void message.error('Помилка оновлення документа');
    }
  };

  const handleSubmit = async () => {
    if (isEdit) {
      await handleEditSubmit();
      return;
    }

    if (!effectiveVehicleId) {
      void message.error('Оберіть автомобіль');
      return;
    }
    if (newFiles.length === 0 && newLinks.length === 0) {
      void message.error('Додайте файл або посилання');
      return;
    }

    try {
      for (const item of newFiles) {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('name', item.name.trim() || item.file.name);
        formData.append('vehicleId', effectiveVehicleId);
        if (expenseId) formData.append('expenseId', expenseId);
        const created = await uploadDoc.mutateAsync(formData);
        onCreated?.(created);
      }

      for (const item of newLinks) {
        const created = await linkDoc.mutateAsync({
          name: item.name,
          url: item.url,
          vehicleId: effectiveVehicleId,
          expenseId: expenseId ?? null,
        });
        onCreated?.(created);
      }

      void message.success('Документ збережено');
      handleClose();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 413) void message.error('Файл надто великий');
      else if (status === 415) void message.error('Тип файлу не підтримується');
      else void message.error('Помилка збереження документа');
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? 'Редагувати документ' : 'Додати документ'}
      onCancel={handleClose}
      footer={null}
      destroyOnHidden
      width={520}
    >
      {needsVehiclePick && !isEdit && (
        <Select
          showSearch
          placeholder="Оберіть автомобіль"
          optionFilterProp="label"
          value={selectedVehicleId}
          onChange={(v: string) => setSelectedVehicleId(v)}
          style={{ width: '100%', marginBottom: 16 }}
          options={(vehiclesData?.items ?? []).map((v) => ({
            value: v.id,
            label: `${v.identifier} — ${v.brand} ${v.model}`,
          }))}
        />
      )}

      <Space direction="vertical" style={{ width: '100%' }}>
        {isEdit ? (
          <FileAttachmentField
            allowFiles={document?.kind === 'upload'}
            acceptedMimeTypes={ALLOWED_MIME_TYPES}
            editableExistingItems
            emptyText="Документ не вибрано"
            existingItems={existingItems}
            getNewFileInitialName={() => existingItems[0]?.name ?? document?.name ?? ''}
            hideExistingItemsWhenNewFilesAdded
            maxSizeBytes={MAX_SIZE_BYTES}
            multiple={false}
            newFiles={newFiles}
            onExistingItemsChange={setExistingItems}
            onNewFilesChange={setNewFiles}
            uploadText="Натисніть або перетягніть новий файл"
            uploadHint="Якщо файл не додавати, оновиться лише назва документа"
          />
        ) : (
          <FileAttachmentField
            allowLinks
            acceptedMimeTypes={ALLOWED_MIME_TYPES}
            maxSizeBytes={MAX_SIZE_BYTES}
            multiple
            newFiles={newFiles}
            onNewFilesChange={setNewFiles}
            newLinks={newLinks}
            onNewLinksChange={setNewLinks}
          />
        )}
        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={handleClose}>Скасувати</Button>
          <Button
            type="primary"
            onClick={() => void handleSubmit()}
            loading={isPending}
            disabled={!isEdit && newFiles.length === 0 && newLinks.length === 0}
          >
            Зберегти
          </Button>
        </Space>
      </Space>
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
