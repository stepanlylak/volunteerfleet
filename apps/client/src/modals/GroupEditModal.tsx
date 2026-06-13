import { Button, Form, Input, Modal, Space, message } from 'antd';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  FileAttachmentField,
  type FileAttachmentExistingItem,
  type FileAttachmentNewFile,
  type FileAttachmentNewLink,
} from '../components/files/FileAttachmentField';
import { documentsApi } from '../api/documents.api';
import { documentGroupsApi } from '../api/documentGroups.api';
import { useDocumentGroup } from '../hooks/useDocumentGroups';

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

interface GroupEditModalProps {
  open: boolean;
  vehicleId: string;
  groupId: string;
  onClose: () => void;
}

export function GroupEditModal({ open, vehicleId, groupId, onClose }: GroupEditModalProps) {
  const queryClient = useQueryClient();
  const { data: group, isLoading } = useDocumentGroup(open ? groupId : undefined);
  const [name, setName] = useState('');
  const [existingItems, setExistingItems] = useState<FileAttachmentExistingItem[]>([]);
  const [newFiles, setNewFiles] = useState<FileAttachmentNewFile[]>([]);
  const [newLinks, setNewLinks] = useState<FileAttachmentNewLink[]>([]);
  const [removedExistingIds, setRemovedExistingIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? '');
    setExistingItems((group?.documents ?? []).map(toAttachmentItem));
    setNewFiles([]);
    setNewLinks([]);
    setRemovedExistingIds([]);
  }, [open, group]);

  const activeExistingItems = existingItems.filter((item) => !removedExistingIds.includes(item.id));
  const activeItemCount = activeExistingItems.length + newFiles.length + newLinks.length;

  const handleSave = async () => {
    const itemWithEmptyName = [...activeExistingItems, ...newFiles, ...newLinks].find(
      (item) => !item.name.trim(),
    );
    if (itemWithEmptyName) {
      void message.error('Введіть назву файла');
      return;
    }

    setSaving(true);
    try {
      const nextGroupName = activeItemCount > 1 ? name.trim() || null : null;
      if ((group?.name ?? null) !== nextGroupName) {
        await documentGroupsApi.update(groupId, { name: nextGroupName });
      }
      for (const item of activeExistingItems) {
        const original = group?.documents.find((document) => document.id === item.id);
        const nextName = item.name.trim();
        const nextUrl = item.kind === 'link' ? item.url?.trim() : undefined;
        if (item.kind === 'link' && !nextUrl) {
          void message.error('Введіть посилання');
          return;
        }

        const nameChanged = original?.name !== nextName;
        const urlChanged = item.kind === 'link' && original?.url !== nextUrl;
        if (nameChanged || urlChanged) {
          await documentsApi.update(item.id, {
            ...(nameChanged ? { name: nextName } : {}),
            ...(urlChanged ? { url: nextUrl } : {}),
          });
        }
      }
      for (const file of newFiles) {
        const formData = new FormData();
        formData.append('file', file.file);
        formData.append('name', file.name.trim() || file.file.name);
        formData.append('groupId', groupId);
        await documentsApi.upload(formData);
      }
      for (const link of newLinks) {
        await documentsApi.link({
          name: link.name,
          url: link.url,
          groupId,
        });
      }
      for (const id of removedExistingIds) {
        await documentsApi.remove(id);
      }

      void queryClient.invalidateQueries({ queryKey: ['documents', 'vehicle', vehicleId] });
      void queryClient.invalidateQueries({ queryKey: ['document-groups', groupId] });
      void message.success('Документ оновлено');
      onClose();
    } catch {
      void message.error('Помилка збереження документа');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Редагувати документ"
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={520}
    >
      <Form layout="vertical">
        {activeItemCount > 1 ? (
          <Form.Item label="Назва документа">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Назва документа (необовʼязково)"
              maxLength={255}
            />
          </Form.Item>
        ) : null}
        <Form.Item label="Файли">
          <FileAttachmentField
            allowLinks
            multiple
            acceptedMimeTypes={ALLOWED_MIME_TYPES}
            maxSizeBytes={MAX_SIZE_BYTES}
            loading={isLoading}
            existingItems={existingItems}
            onExistingItemsChange={setExistingItems}
            editableExistingItems
            removedExistingIds={removedExistingIds}
            onRemovedExistingIdsChange={setRemovedExistingIds}
            newFiles={newFiles}
            onNewFilesChange={setNewFiles}
            newLinks={newLinks}
            onNewLinksChange={setNewLinks}
          />
        </Form.Item>
        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onClose}>Скасувати</Button>
          <Button type="primary" onClick={() => void handleSave()} loading={saving}>
            Зберегти
          </Button>
        </Space>
      </Form>
    </Modal>
  );
}

function toAttachmentItem(
  document: NonNullable<ReturnType<typeof useDocumentGroup>['data']>['documents'][number],
): FileAttachmentExistingItem {
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
