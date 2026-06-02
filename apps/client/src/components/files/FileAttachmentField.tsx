import {
  DeleteOutlined,
  DownloadOutlined,
  InboxOutlined,
  LinkOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Image,
  Input,
  List,
  Select,
  Space,
  Typography,
  Upload,
  message,
  Divider,
} from 'antd';
import type { RcFile } from 'antd/es/upload';
import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';

export interface FileAttachmentExistingItem {
  id: string;
  name: string;
  kind?: 'upload' | 'link' | 'photo';
  mimeType?: string | null;
  sizeBytes?: number | null;
  url?: string | null;
  previewUrl?: string;
  downloadUrl?: string;
}

export interface FileAttachmentNewFile {
  uid: string;
  file: RcFile;
  name: string;
}

export interface FileAttachmentNewLink {
  id: string;
  name: string;
  url: string;
}

interface FileAttachmentFieldProps {
  existingItems?: FileAttachmentExistingItem[];
  onExistingItemsChange?: (items: FileAttachmentExistingItem[]) => void;
  newFiles: FileAttachmentNewFile[];
  onNewFilesChange: Dispatch<SetStateAction<FileAttachmentNewFile[]>>;
  newLinks?: FileAttachmentNewLink[];
  onNewLinksChange?: (links: FileAttachmentNewLink[]) => void;
  removedExistingIds?: string[];
  onRemovedExistingIdsChange?: (ids: string[]) => void;
  selectableExistingItems?: FileAttachmentExistingItem[];
  selectedExistingIds?: string[];
  onSelectedExistingIdsChange?: (ids: string[]) => void;
  selectExistingPlaceholder?: string;
  allowLinks?: boolean;
  allowFiles?: boolean;
  multiple?: boolean;
  maxFiles?: number;
  maxSizeBytes?: number;
  acceptedMimeTypes?: string[];
  uploadText?: string;
  uploadHint?: string;
  editableExistingItems?: boolean;
  editableNewFileNames?: boolean;
  getNewFileInitialName?: (file: RcFile) => string;
  getNewFileDisplayName?: (
    item: FileAttachmentNewFile,
    index: number,
    existingFileCount: number,
  ) => string;
  hideExistingItemsWhenNewFilesAdded?: boolean;
  maxSizeErrorMessage?: string;
  mimeTypeErrorMessage?: string;
  maxFilesErrorMessage?: string;
  emptyText?: string;
  disabled?: boolean;
  loading?: boolean;
}

const DEFAULT_MAX_SIZE_BYTES = 26_214_400;
const DEFAULT_MAX_FILES = 10;
const localFilePreviewUrls = new WeakMap<File, string>();

export function FileAttachmentField({
  existingItems = [],
  onExistingItemsChange,
  newFiles,
  onNewFilesChange,
  newLinks = [],
  onNewLinksChange,
  removedExistingIds = [],
  onRemovedExistingIdsChange,
  selectableExistingItems = [],
  selectedExistingIds = [],
  onSelectedExistingIdsChange,
  selectExistingPlaceholder = 'Вибрати існуючі документи',
  allowLinks = false,
  allowFiles = true,
  multiple = true,
  maxFiles = DEFAULT_MAX_FILES,
  maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
  acceptedMimeTypes,
  uploadText,
  uploadHint,
  editableExistingItems = false,
  editableNewFileNames = true,
  getNewFileInitialName,
  getNewFileDisplayName,
  hideExistingItemsWhenNewFilesAdded = false,
  maxSizeErrorMessage = 'Файл перевищує 25 МБ',
  mimeTypeErrorMessage = 'Тип файлу не підтримується',
  maxFilesErrorMessage = 'Перевищено ліміт файлів',
  emptyText = 'Прикріплених файлів ще немає',
  disabled = false,
  loading = false,
}: FileAttachmentFieldProps) {
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const visibleExistingItems = existingItems.filter(
    (item) => !removedExistingIds.includes(item.id),
  );
  const displayedExistingItems =
    hideExistingItemsWhenNewFilesAdded && newFiles.length > 0 ? [] : visibleExistingItems;
  const displayedExistingIds = new Set(displayedExistingItems.map((item) => item.id));
  const selectedExistingItems = selectableExistingItems.filter(
    (item) => selectedExistingIds.includes(item.id) && !displayedExistingIds.has(item.id),
  );
  const existingFileCount = visibleExistingItems.filter((item) => item.kind !== 'link').length;
  const canAddLinks = allowLinks && onNewLinksChange;
  const canSelectExisting = selectableExistingItems.length > 0 && onSelectedExistingIdsChange;

  const beforeUpload = (file: RcFile): boolean => {
    if (file.size > maxSizeBytes) {
      void message.error(maxSizeErrorMessage);
      return false;
    }

    if (acceptedMimeTypes && !isAcceptedFile(file, acceptedMimeTypes)) {
      void message.error(mimeTypeErrorMessage);
      return false;
    }

    onNewFilesChange((current) =>
      addNewFile(current, file, {
        multiple,
        maxFiles,
        existingFileCount,
        getNewFileInitialName,
        maxFilesErrorMessage,
      }),
    );
    return false;
  };

  const handleAddLink = () => {
    if (!canAddLinks) return;
    const name = linkName.trim();
    const url = linkUrl.trim();

    if (!name) {
      void message.error('Введіть назву посилання');
      return;
    }

    if (!isValidUrl(url)) {
      void message.error('Невірний формат URL');
      return;
    }

    const nextLink = {
      id: createLocalId(),
      name,
      url,
    };
    canAddLinks(multiple ? [...newLinks, nextLink] : [nextLink]);
    setLinkName('');
    setLinkUrl('');
  };

  const hasItems =
    displayedExistingItems.length > 0 ||
    selectedExistingItems.length > 0 ||
    newFiles.length > 0 ||
    newLinks.length > 0;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {allowFiles ? (
        <Upload.Dragger
          multiple={multiple}
          accept={acceptedMimeTypes?.join(',')}
          beforeUpload={beforeUpload}
          showUploadList={false}
          fileList={[]}
          disabled={disabled}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            {uploadText ??
              (multiple ? 'Натисніть або перетягніть файли' : 'Натисніть або перетягніть файл')}
          </p>
          <p className="ant-upload-hint">
            {uploadHint ?? 'PDF, зображення, Word, Excel, CSV — до 25 МБ'}
          </p>
        </Upload.Dragger>
      ) : null}

      {canAddLinks ? (
        <>
          <Divider plain dashed style={{ margin: 0 }}>
            або
          </Divider>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="Назва посилання"
              value={linkName}
              onChange={(event) => setLinkName(event.target.value)}
              disabled={disabled}
              style={{ width: '32%' }}
            />
            <Input
              placeholder="https://..."
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              disabled={disabled}
            />
            <Button icon={<PlusOutlined />} onClick={handleAddLink} disabled={disabled}>
              Додати
            </Button>
          </Space.Compact>
        </>
      ) : null}

      {canSelectExisting ? (
        <>
          <Divider plain dashed style={{ margin: 0 }}>
            або
          </Divider>
          <Select
            mode="multiple"
            placeholder={selectExistingPlaceholder}
            value={selectedExistingIds}
            onChange={onSelectedExistingIdsChange}
            options={selectableExistingItems.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            optionFilterProp="label"
            maxTagCount="responsive"
            style={{ width: '100%' }}
            disabled={disabled}
          />
        </>
      ) : null}

      <List
        size="small"
        loading={loading}
        dataSource={[
          ...displayedExistingItems.map((item) => ({
            type: 'existing' as const,
            item,
            source: 'attached' as const,
          })),
          ...selectedExistingItems.map((item) => ({
            type: 'existing' as const,
            item,
            source: 'selected' as const,
          })),
          ...newFiles.map((item, index) => ({ type: 'file' as const, item, index })),
          ...newLinks.map((item) => ({ type: 'link' as const, item })),
        ]}
        locale={{ emptyText }}
        style={{ display: hasItems || loading ? undefined : 'none' }}
        renderItem={(entry) => {
          if (entry.type === 'existing') {
            return (
              <ExistingAttachmentItem
                item={entry.item}
                disabled={disabled}
                editable={editableExistingItems && entry.source === 'attached'}
                canRemove={
                  entry.source === 'selected'
                    ? Boolean(onSelectedExistingIdsChange)
                    : Boolean(onRemovedExistingIdsChange)
                }
                onChange={(patch) => {
                  onExistingItemsChange?.(
                    existingItems.map((item) =>
                      item.id === entry.item.id ? { ...item, ...patch } : item,
                    ),
                  );
                }}
                onRemove={
                  entry.source === 'selected'
                    ? () =>
                        onSelectedExistingIdsChange?.(
                          selectedExistingIds.filter((id) => id !== entry.item.id),
                        )
                    : onRemovedExistingIdsChange
                      ? () => onRemovedExistingIdsChange([...removedExistingIds, entry.item.id])
                      : undefined
                }
              />
            );
          }

          if (entry.type === 'file') {
            return (
              <NewFileAttachmentItem
                item={entry.item}
                disabled={disabled}
                editableName={editableNewFileNames}
                displayName={
                  getNewFileDisplayName?.(entry.item, entry.index, existingFileCount) ??
                  entry.item.name
                }
                onRename={(name) => {
                  onNewFilesChange((current) =>
                    current.map((file) => (file.uid === entry.item.uid ? { ...file, name } : file)),
                  );
                }}
                onRemove={() => {
                  onNewFilesChange((current) =>
                    current.filter((file) => file.uid !== entry.item.uid),
                  );
                }}
              />
            );
          }

          return (
            <List.Item
              actions={[
                <Button
                  key="remove"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={disabled}
                  onClick={() =>
                    onNewLinksChange?.(newLinks.filter((link) => link.id !== entry.item.id))
                  }
                />,
              ]}
            >
              <List.Item.Meta
                avatar={<LinkOutlined />}
                title={entry.item.name}
                description={entry.item.url}
              />
            </List.Item>
          );
        }}
      />
    </Space>
  );
}

interface AddFileOptions {
  multiple: boolean;
  maxFiles: number;
  existingFileCount: number;
  getNewFileInitialName?: (file: RcFile) => string;
  maxFilesErrorMessage: string;
}

function addNewFile(
  current: FileAttachmentNewFile[],
  file: RcFile,
  options: AddFileOptions,
): FileAttachmentNewFile[] {
  const name = options.getNewFileInitialName?.(file) ?? file.name;

  if (!options.multiple) {
    return [{ uid: file.uid, file, name }];
  }

  if (options.existingFileCount + current.length >= options.maxFiles) {
    void message.error(options.maxFilesErrorMessage);
    return current;
  }

  if (current.some((item) => item.uid === file.uid)) return current;

  return [...current, { uid: file.uid, file, name }];
}

function ExistingAttachmentItem({
  item,
  disabled,
  editable,
  canRemove,
  onChange,
  onRemove,
}: {
  item: FileAttachmentExistingItem;
  disabled: boolean;
  editable: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<FileAttachmentExistingItem>) => void;
  onRemove?: () => void;
}) {
  const isImage = isImageLike(item.name, item.mimeType);
  const openUrl = item.kind === 'link' ? item.url : item.downloadUrl;

  return (
    <List.Item
      actions={[
        openUrl ? (
          <Button
            key="open"
            size="small"
            icon={item.kind === 'link' ? <LinkOutlined /> : <DownloadOutlined />}
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
          />
        ) : null,
        canRemove ? (
          <Button
            key="remove"
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={disabled}
            onClick={onRemove}
          />
        ) : null,
      ].filter(Boolean)}
    >
      <List.Item.Meta
        avatar={
          isImage && item.previewUrl ? (
            <Image width={48} height={48} style={{ objectFit: 'cover' }} src={item.previewUrl} />
          ) : undefined
        }
        title={
          editable ? (
            <Input
              value={item.name}
              onChange={(event) => onChange({ name: event.target.value })}
              disabled={disabled}
            />
          ) : (
            item.name
          )
        }
        description={
          editable && item.kind === 'link' ? (
            <Input
              placeholder="https://..."
              value={item.url ?? ''}
              onChange={(event) => onChange({ url: event.target.value })}
              disabled={disabled}
            />
          ) : (
            describeExistingItem(item)
          )
        }
      />
    </List.Item>
  );
}

function NewFileAttachmentItem({
  item,
  disabled,
  editableName,
  displayName,
  onRename,
  onRemove,
}: {
  item: FileAttachmentNewFile;
  disabled: boolean;
  editableName: boolean;
  displayName: string;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const isImage = isImageLike(item.file.name, item.file.type);

  return (
    <List.Item
      actions={[
        <Button
          key="remove"
          size="small"
          danger
          icon={<DeleteOutlined />}
          disabled={disabled}
          onClick={onRemove}
        />,
      ]}
    >
      <List.Item.Meta
        avatar={isImage ? <LocalImagePreview file={item.file} /> : undefined}
        title={
          editableName ? (
            <Input
              value={item.name}
              onChange={(event) => onRename(event.target.value)}
              disabled={disabled}
            />
          ) : (
            <Typography.Text strong>{displayName}</Typography.Text>
          )
        }
        description={
          <Typography.Text type="secondary">
            {item.file.name} · {formatBytes(item.file.size)}
          </Typography.Text>
        }
      />
    </List.Item>
  );
}

function LocalImagePreview({ file }: { file: RcFile }) {
  return (
    <Image width={48} height={48} style={{ objectFit: 'cover' }} src={getLocalPreviewUrl(file)} />
  );
}

function describeExistingItem(item: FileAttachmentExistingItem): string {
  if (item.kind === 'link') return item.url ?? 'Посилання';
  const parts = [item.mimeType, item.sizeBytes ? formatBytes(item.sizeBytes) : null].filter(
    Boolean,
  );
  return parts.join(' · ') || 'Файл';
}

function isAcceptedFile(file: RcFile, acceptedMimeTypes: string[]): boolean {
  if (file.type && acceptedMimeTypes.includes(file.type)) return true;

  const inferredMimeType = inferMimeTypeFromName(file.name);
  return Boolean(inferredMimeType && acceptedMimeTypes.includes(inferredMimeType));
}

function getLocalPreviewUrl(file: RcFile): string {
  const existingUrl = localFilePreviewUrls.get(file);
  if (existingUrl) return existingUrl;

  const url = URL.createObjectURL(file);
  localFilePreviewUrls.set(file, url);
  return url;
}

function isImageLike(name: string, mimeType?: string | null): boolean {
  return Boolean(
    mimeType?.startsWith('image/') || inferMimeTypeFromName(name)?.startsWith('image/'),
  );
}

function inferMimeTypeFromName(name: string): string | null {
  const extension = name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'txt':
      return 'text/plain';
    case 'csv':
      return 'text/csv';
    default:
      return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function createLocalId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `link-${Date.now()}-${Math.random()}`;
}
