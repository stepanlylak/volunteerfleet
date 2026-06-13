import type { DocumentResponse } from '@volunteerfleet/shared';
import type { FileAttachmentExistingItem } from '../components/files/FileAttachmentField';

export interface DocumentPickerItems {
  items: FileAttachmentExistingItem[];
  // item id (group id or legacy doc id) -> member document ids
  docIdsById: Record<string, string[]>;
  // item id -> display name used to autocomplete a group name on selection
  nameById: Record<string, string>;
}

// Turns a flat document list into selectable "logical documents": each group is
// one item (single-file groups and legacy ungrouped docs render as the file),
// multi-file groups render as one entry. Selecting an item yields all its files.
export function buildDocumentPickerItems(
  docs: DocumentResponse[],
  getDownloadUrl: (id: string, cacheKey?: string) => string,
): DocumentPickerItems {
  const groupOrder: string[] = [];
  const groupMap = new Map<string, DocumentResponse[]>();
  const items: FileAttachmentExistingItem[] = [];
  const docIdsById: Record<string, string[]> = {};
  const nameById: Record<string, string> = {};

  const leaf = (id: string, doc: DocumentResponse, label: string) => {
    items.push({
      id,
      name: label,
      kind: doc.kind,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      url: doc.url,
      downloadUrl: doc.kind === 'upload' ? getDownloadUrl(doc.id, doc.updatedAt) : undefined,
    });
    docIdsById[id] = [doc.id];
    nameById[id] = label;
  };

  for (const doc of docs) {
    if (doc.groupId) {
      if (!groupMap.has(doc.groupId)) {
        groupMap.set(doc.groupId, []);
        groupOrder.push(doc.groupId);
      }
      groupMap.get(doc.groupId)!.push(doc);
    } else {
      leaf(doc.id, doc, doc.name);
    }
  }

  for (const groupId of groupOrder) {
    const groupDocs = groupMap.get(groupId)!;
    const label = groupDocs[0]!.group?.name?.trim() || groupDocs[0]!.name;
    if (groupDocs.length === 1) {
      leaf(groupId, groupDocs[0]!, label);
    } else {
      items.push({ id: groupId, name: label, fileCount: groupDocs.length });
      docIdsById[groupId] = groupDocs.map((d) => d.id);
      nameById[groupId] = label;
    }
  }

  return { items, docIdsById, nameById };
}
