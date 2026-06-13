import { Button, Modal, Select, Space, message } from 'antd';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  FileAttachmentField,
  type FileAttachmentNewFile,
  type FileAttachmentNewLink,
} from '../components/files/FileAttachmentField';
import { GroupingToggle } from '../components/files/GroupingToggle';
import { useVehicles } from '../hooks/useVehicles';
import { buildDocumentGroup, MOVE_CANCELLED } from '../utils/buildDocumentGroup';

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
  onClose: () => void;
}

export function DocumentFormModal({ open, vehicleId, expenseId, onClose }: DocumentFormModalProps) {
  const [newFiles, setNewFiles] = useState<FileAttachmentNewFile[]>([]);
  const [newLinks, setNewLinks] = useState<FileAttachmentNewLink[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(vehicleId);
  const [grouped, setGrouped] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const needsVehiclePick = !vehicleId;
  const effectiveVehicleId = vehicleId ?? selectedVehicleId;
  const { data: vehiclesData } = useVehicles({ pageSize: 100 });

  useEffect(() => {
    if (!open) return;
    setSelectedVehicleId(vehicleId);
    setNewFiles([]);
    setNewLinks([]);
    setGrouped(false);
    setGroupName('');
  }, [open, vehicleId]);

  const handleClose = () => {
    setNewFiles([]);
    setNewLinks([]);
    setSelectedVehicleId(vehicleId);
    onClose();
  };

  const handleSubmit = async () => {
    if (!effectiveVehicleId) {
      void message.error('Оберіть автомобіль');
      return;
    }
    if (newFiles.length === 0 && newLinks.length === 0) {
      void message.error('Додайте файл або посилання');
      return;
    }

    const multipleItems = newFiles.length + newLinks.length > 1;

    setSaving(true);
    try {
      if (expenseId) {
        await buildDocumentGroup({
          vehicleId: effectiveVehicleId,
          expenseId,
          name: groupName.trim() || 'Документи витрати',
          newFiles,
          newLinks,
          selectedExisting: [],
        });
      } else if (grouped && multipleItems) {
        // Whole batch becomes one logical document (a named group).
        await buildDocumentGroup({
          vehicleId: effectiveVehicleId,
          name: groupName.trim() || null,
          newFiles,
          newLinks,
          selectedExisting: [],
        });
      } else {
        // Each file/link becomes its own single-file group.
        for (const item of newFiles) {
          await buildDocumentGroup({
            vehicleId: effectiveVehicleId,
            newFiles: [item],
            newLinks: [],
            selectedExisting: [],
          });
        }
        for (const item of newLinks) {
          await buildDocumentGroup({
            vehicleId: effectiveVehicleId,
            newFiles: [],
            newLinks: [item],
            selectedExisting: [],
          });
        }
      }

      void queryClient.invalidateQueries({
        queryKey: ['documents', 'vehicle', effectiveVehicleId],
      });
      void message.success('Документ збережено');
      handleClose();
    } catch (err: unknown) {
      if (err instanceof Error && err.message === MOVE_CANCELLED) return;
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 413) void message.error('Файл надто великий');
      else if (status === 415) void message.error('Тип файлу не підтримується');
      else void message.error('Помилка збереження документа');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Додати документ"
      onCancel={handleClose}
      footer={null}
      destroyOnHidden
      width={520}
    >
      {needsVehiclePick && (
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
        {!expenseId && newFiles.length + newLinks.length > 1 && (
          <GroupingToggle
            mode="optional"
            checked={grouped}
            onChange={setGrouped}
            name={groupName}
            onNameChange={setGroupName}
            namePlaceholder="Назва документа (необовʼязково)"
          />
        )}
        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={handleClose}>Скасувати</Button>
          <Button
            type="primary"
            onClick={() => void handleSubmit()}
            loading={saving}
            disabled={newFiles.length === 0 && newLinks.length === 0}
          >
            Зберегти
          </Button>
        </Space>
      </Space>
    </Modal>
  );
}
