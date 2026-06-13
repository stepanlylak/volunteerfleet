import { PaperClipOutlined } from '@ant-design/icons';
import { Button, Popover, Space, Spin, Typography } from 'antd';
import { useState } from 'react';
import { documentsApi } from '../../api/documents.api';
import { useDocumentGroup } from '../../hooks/useDocumentGroups';

interface StatusHistoryGroupLinksProps {
  label: string;
  groupId: string;
}

// Timeline button for a status slot: opens a popover listing the group's
// documents (downloads), fetched lazily on first open.
export function StatusHistoryGroupLinks({ label, groupId }: StatusHistoryGroupLinksProps) {
  const [open, setOpen] = useState(false);
  const { data: group, isLoading } = useDocumentGroup(groupId, open);
  const docs = group?.documents ?? [];

  const content = isLoading ? (
    <Spin size="small" />
  ) : docs.length === 0 ? (
    <Typography.Text type="secondary">Немає файлів</Typography.Text>
  ) : (
    <Space direction="vertical" size={4}>
      {docs.map((doc) => (
        <Button
          key={doc.id}
          size="small"
          type="link"
          icon={<PaperClipOutlined />}
          href={
            doc.kind === 'link'
              ? (doc.url ?? undefined)
              : documentsApi.getDownloadUrl(doc.id, doc.updatedAt)
          }
          target="_blank"
          rel="noopener noreferrer"
        >
          {doc.name}
        </Button>
      ))}
    </Space>
  );

  return (
    <Popover content={content} trigger="click" open={open} onOpenChange={setOpen}>
      <Button size="small" icon={<PaperClipOutlined />}>
        {label}
        {group ? ` (${docs.length})` : ''}
      </Button>
    </Popover>
  );
}
