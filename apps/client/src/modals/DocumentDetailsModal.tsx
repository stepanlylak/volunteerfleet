import { useState, useEffect, useMemo } from 'react';
import { Button, Modal, Space, Spin, Tag, Typography, Image } from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  DownloadOutlined,
  LinkOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import type { DocumentResponse } from '@volunteerfleet/shared';
import { useDocument } from '../hooks/useDocuments';
import { documentsApi } from '../api/documents.api';
import { formatFileSize } from '../utils/format';

interface DocumentDetailsModalProps {
  open: boolean;
  documentIds: string[];
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

function DocumentContent({ doc }: { doc: DocumentResponse }) {
  const downloadUrl = useMemo(
    () => documentsApi.getDownloadUrl(doc.id, undefined, 'inline'),
    [doc.id],
  );
  const attachmentUrl = useMemo(
    () => documentsApi.getDownloadUrl(doc.id, undefined, 'attachment'),
    [doc.id],
  );

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

  // Image preview
  if (doc.mimeType?.startsWith('image/')) {
    return (
      <div style={{ textAlign: 'center' }}>
        <Image
          src={downloadUrl}
          alt={doc.name}
          style={{ maxWidth: '100%', maxHeight: 400, objectFit: 'contain' }}
          placeholder={<Spin />}
        />
        <div style={{ marginTop: 16 }}>
          <Button icon={<DownloadOutlined />} href={attachmentUrl} target="_blank">
            Завантажити
          </Button>
        </div>
      </div>
    );
  }

  // PDF preview
  if (doc.mimeType === 'application/pdf') {
    return (
      <div>
        <iframe
          src={downloadUrl}
          sandbox="allow-scripts allow-same-origin"
          title={doc.name}
          style={{ width: '100%', height: 400, border: 'none' }}
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
      <PaperClipOutlined style={{ fontSize: 48, color: '#8c8c8c', marginBottom: 16 }} />
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
  initialIndex = 0,
  onClose,
}: DocumentDetailsModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentId = documentIds[currentIndex];

  const { data: doc, isLoading } = useDocument(currentId);

  // Reset index when modal opens or documentIds change
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex, documentIds.length]);

  // Don't render if no documents
  if (!open || documentIds.length === 0) {
    return null;
  }

  const hasMultiple = documentIds.length > 1;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : documentIds.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < documentIds.length - 1 ? prev + 1 : 0));
  };

  return (
    <Modal
      open={open}
      title={
        hasMultiple ? (
          <Space>
            <span>Документи</span>
            <Typography.Text type="secondary">
              ({currentIndex + 1} / {documentIds.length})
            </Typography.Text>
          </Space>
        ) : (
          'Документ'
        )
      }
      onCancel={onClose}
      footer={
        hasMultiple ? (
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Button icon={<LeftOutlined />} onClick={handlePrev}>
              Попередній
            </Button>
            <Button icon={<RightOutlined />} onClick={handleNext}>
              Наступний
            </Button>
          </Space>
        ) : (
          <Button onClick={onClose}>Закрити</Button>
        )
      }
      width={720}
      destroyOnHidden
    >
      {isLoading || !doc ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <DocumentContent doc={doc} />
          <DocumentInfo doc={doc} />
        </Space>
      )}
    </Modal>
  );
}
