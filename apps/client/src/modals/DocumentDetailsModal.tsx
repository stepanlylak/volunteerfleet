import { useState, useEffect, useMemo } from 'react';
import { Button, Modal, Space, Spin, Tag, Typography, Image } from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  DownloadOutlined,
  LinkOutlined,
  PaperClipOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  FileOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons';
import type { DocumentResponse } from '@volunteerfleet/shared';
import { useDocument } from '../hooks/useDocuments';
import { documentsApi } from '../api/documents.api';
import { formatFileSize } from '../utils/format';

interface DocumentDetailsModalProps {
  open: boolean;
  documentIds?: string[];
  documents?: DocumentResponse[];
  initialIndex?: number;
  onClose: () => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getFileIcon(mimeType?: string | null) {
  if (mimeType === 'application/pdf') {
    return <FilePdfOutlined style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 16 }} />;
  }
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return <FileWordOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />;
  }
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'text/csv'
  ) {
    return <FileExcelOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />;
  }
  if (mimeType === 'text/plain') {
    return <FileTextOutlined style={{ fontSize: 48, color: '#8c8c8c', marginBottom: 16 }} />;
  }
  return <FileOutlined style={{ fontSize: 48, color: '#8c8c8c', marginBottom: 16 }} />;
}

function DocumentContent({ doc, isFullscreen }: { doc: DocumentResponse; isFullscreen: boolean }) {
  const downloadUrl = useMemo(
    () => documentsApi.getDownloadUrl(doc.id, doc.updatedAt, 'inline'),
    [doc.id, doc.updatedAt],
  );
  const attachmentUrl = useMemo(
    () => documentsApi.getDownloadUrl(doc.id, doc.updatedAt, 'attachment'),
    [doc.id, doc.updatedAt],
  );

  const contentHeight = isFullscreen ? 'calc(100vh - 260px)' : 400;

  // Link documents - don't embed, show URL + button
  if (doc.kind === 'link') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <PaperClipOutlined style={{ fontSize: 48, color: '#8c8c8c', marginBottom: 16 }} />
        <Typography.Title level={5}>Зовнішнє посилання</Typography.Title>
        <Typography.Paragraph>
          <a href={doc.url ?? '#'} target="_blank" rel="noopener noreferrer">
            {doc.url}
          </a>
        </Typography.Paragraph>
        <Button type="primary" icon={<LinkOutlined />} href={doc.url ?? '#'} target="_blank">
          Відкрити посилання
        </Button>
      </div>
    );
  }

  // PDF preview
  if (doc.mimeType === 'application/pdf') {
    return (
      <div>
        <iframe
          src={downloadUrl}
          title={doc.name}
          style={{ width: '100%', height: contentHeight, border: 'none' }}
        />
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button icon={<DownloadOutlined />} href={attachmentUrl} target="_blank">
            Завантажити
          </Button>
        </div>
      </div>
    );
  }

  // Other types - placeholder + download
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      {getFileIcon(doc.mimeType)}
      <Typography.Paragraph type="secondary">Перегляд недоступний</Typography.Paragraph>
      <Button icon={<DownloadOutlined />} href={attachmentUrl} target="_blank">
        Завантажити
      </Button>
    </div>
  );
}

function DocumentInfo({ doc }: { doc: DocumentResponse }) {
  return (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      <div>
        <Typography.Text type="secondary">Назва: </Typography.Text>
        <Typography.Text strong>{doc.name}</Typography.Text>
      </div>
      <div>
        <Typography.Text type="secondary">Тип: </Typography.Text>
        <Tag>{doc.kind === 'upload' ? 'Файл' : 'Посилання'}</Tag>
        {doc.mimeType && <Tag>{doc.mimeType}</Tag>}
      </div>
      {doc.sizeBytes != null && (
        <div>
          <Typography.Text type="secondary">Розмір: </Typography.Text>
          <Typography.Text>{formatFileSize(doc.sizeBytes)}</Typography.Text>
        </div>
      )}
      <div>
        <Typography.Text type="secondary">Додано: </Typography.Text>
        <Typography.Text>{formatDate(doc.createdAt)}</Typography.Text>
      </div>
      <div>
        <Typography.Text type="secondary">Ким: </Typography.Text>
        <Typography.Text>{doc.createdBy.fullName}</Typography.Text>
      </div>
    </Space>
  );
}

export function DocumentDetailsModal({
  open,
  documentIds,
  documents: documentsProp,
  initialIndex = 0,
  onClose,
}: DocumentDetailsModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const resolvedIds = documentIds ?? documentsProp?.map((d) => d.id) ?? [];
  const currentId = resolvedIds[currentIndex];

  const { data: fetchedDoc, isLoading: isLoadingFetched } = useDocument(
    documentsProp ? undefined : currentId,
  );

  const documents = useMemo(() => {
    if (documentsProp) return documentsProp;
    if (resolvedIds.length === 0) return [];
    if (!fetchedDoc) return [];
    // When only documentIds are provided, each current document is fetched individually.
    // We keep the current document as the single item in the list.
    return [fetchedDoc];
  }, [documentsProp, fetchedDoc, resolvedIds.length]);

  const doc = documents[currentIndex];
  const isLoading = documentsProp ? false : isLoadingFetched;

  // Reset index and fullscreen state when modal opens or input changes
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setIsFullscreen(false);
      setLightboxOpen(false);
    }
  }, [open, initialIndex, resolvedIds.length]);

  const hasMultiple = documents.length > 1;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : documents.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < documents.length - 1 ? prev + 1 : 0));
  };

  const imageDocuments = useMemo(
    () => documents.filter((d) => d.kind === 'upload' && d.mimeType?.startsWith('image/')),
    [documents],
  );
  const currentImageIndex = Math.max(
    0,
    imageDocuments.findIndex((d) => d.id === doc?.id),
  );

  const handleLightboxChange = (nextIndex: number) => {
    const nextDoc = imageDocuments[nextIndex];
    if (!nextDoc) return;
    const nextDocumentIndex = documents.findIndex((d) => d.id === nextDoc.id);
    if (nextDocumentIndex !== -1) {
      setCurrentIndex(nextDocumentIndex);
    }
  };

  if (!open || documents.length === 0) {
    return null;
  }

  return (
    <Modal
      open={open}
      title={
        <Space>
          <span>{hasMultiple ? 'Документи' : 'Документ'}</span>
          {hasMultiple && (
            <Typography.Text type="secondary">
              ({currentIndex + 1} / {documents.length})
            </Typography.Text>
          )}
        </Space>
      }
      onCancel={onClose}
      footer={
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space>
            {hasMultiple && (
              <Button icon={<LeftOutlined />} onClick={handlePrev}>
                Попередній
              </Button>
            )}
            {hasMultiple && (
              <Button icon={<RightOutlined />} onClick={handleNext}>
                Наступний
              </Button>
            )}
          </Space>
          <Space>
            <Button
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={() => setIsFullscreen((prev) => !prev)}
            >
              {isFullscreen ? 'Вийти з повноекрану' : 'Повноекранний режим'}
            </Button>
            {!hasMultiple && <Button onClick={onClose}>Закрити</Button>}
          </Space>
        </Space>
      }
      width={isFullscreen ? 'calc(100vw - 48px)' : 720}
      style={isFullscreen ? { top: 24 } : undefined}
      destroyOnHidden
    >
      {isLoading || !doc ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {doc.kind === 'upload' &&
          doc.mimeType?.startsWith('image/') &&
          imageDocuments.length > 0 ? (
            <div style={{ textAlign: 'center' }}>
              <Image.PreviewGroup
                preview={{
                  current: currentImageIndex,
                  visible: lightboxOpen,
                  onVisibleChange: (visible) => setLightboxOpen(visible),
                  onChange: handleLightboxChange,
                }}
              >
                {imageDocuments.map((imageDoc) => {
                  const imageUrl = documentsApi.getDownloadUrl(
                    imageDoc.id,
                    imageDoc.updatedAt,
                    'inline',
                  );
                  const isCurrent = imageDoc.id === doc.id;
                  return (
                    <Image
                      key={imageDoc.id}
                      src={imageUrl}
                      alt={imageDoc.name}
                      style={{
                        maxWidth: '100%',
                        maxHeight: isFullscreen ? 'calc(100vh - 260px)' : 400,
                        objectFit: 'contain',
                        display: isCurrent ? 'inline-block' : 'none',
                      }}
                      placeholder={<Spin />}
                      preview={isCurrent ? true : { visible: false }}
                    />
                  );
                })}
              </Image.PreviewGroup>
              <div style={{ marginTop: 16 }}>
                <Button
                  icon={<DownloadOutlined />}
                  href={documentsApi.getDownloadUrl(doc.id, doc.updatedAt, 'attachment')}
                  target="_blank"
                >
                  Завантажити
                </Button>
              </div>
            </div>
          ) : (
            <DocumentContent doc={doc} isFullscreen={isFullscreen} />
          )}
          <DocumentInfo doc={doc} />
        </Space>
      )}
    </Modal>
  );
}
