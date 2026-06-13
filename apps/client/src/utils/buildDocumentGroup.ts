import { Modal } from 'antd';
import { documentsApi } from '../api/documents.api';
import { documentGroupsApi } from '../api/documentGroups.api';
import type {
  FileAttachmentNewFile,
  FileAttachmentNewLink,
} from '../components/files/FileAttachmentField';

export const MOVE_CANCELLED = 'MOVE_CANCELLED';

export interface ExistingSelection {
  id: string;
  name: string;
  groupId: string | null;
}

interface BuildDocumentGroupArgs {
  vehicleId: string;
  expenseId?: string | null;
  donationId?: string | null;
  name?: string | null;
  newFiles: FileAttachmentNewFile[];
  newLinks: FileAttachmentNewLink[];
  selectedExisting: ExistingSelection[];
  // When set, new attachments are appended into this existing group instead of
  // creating a new one (edit flow). Returned unchanged when nothing is added.
  existingGroupId?: string | null;
}

// Builds/extends a document group from a slot's attachments and returns its id.
// Returns the existing group id (or null) when there is nothing to attach.
// Selected documents that already belong to another group are moved (rejecting
// with MOVE_CANCELLED if the user declines).
export async function buildDocumentGroup(args: BuildDocumentGroupArgs): Promise<string | null> {
  const {
    vehicleId,
    expenseId,
    donationId,
    name,
    newFiles,
    newLinks,
    selectedExisting,
    existingGroupId,
  } = args;

  const hasContent = newFiles.length > 0 || newLinks.length > 0 || selectedExisting.length > 0;
  if (!hasContent) return existingGroupId ?? null;

  const toMove = selectedExisting.filter((doc) => doc.groupId);
  if (toMove.length > 0 && !(await confirmMove(toMove))) {
    throw new Error(MOVE_CANCELLED);
  }

  const groupId =
    existingGroupId ??
    (
      await documentGroupsApi.create({
        vehicleId,
        expenseId: expenseId ?? null,
        donationId: donationId ?? null,
        name: name ?? null,
      })
    ).id;

  for (const file of newFiles) {
    const formData = new FormData();
    formData.append('file', file.file);
    formData.append('name', file.name.trim() || file.file.name);
    formData.append('groupId', groupId);
    await documentsApi.upload(formData);
  }

  for (const link of newLinks) {
    await documentsApi.link({ name: link.name, url: link.url, groupId });
  }

  for (const doc of selectedExisting) {
    await documentGroupsApi.moveDocument(groupId, doc.id);
  }

  return groupId;
}

function confirmMove(docs: ExistingSelection[]): Promise<boolean> {
  const content =
    docs.length === 1
      ? `Файл «${docs[0]?.name}» зараз в іншій групі. Перенести його сюди? Якщо стара група лишиться порожньою, її буде видалено.`
      : `${docs.length} файлів зараз в інших групах. Перенести їх сюди? Порожні старі групи буде видалено.`;
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: 'Перенести файли в цю групу?',
      content,
      okText: 'Перенести',
      cancelText: 'Скасувати',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}
