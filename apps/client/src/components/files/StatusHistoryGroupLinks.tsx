import { PaperClipOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useState } from 'react';
import { useDocumentGroup } from '../../hooks/useDocumentGroups';
import { DocumentDetailsModal } from '../../modals/DocumentDetailsModal';

interface StatusHistoryGroupLinksProps {
  label: string;
  groupId: string;
}

// Timeline button for a status slot: opens the unified document preview modal
// with the group's documents, fetched lazily on first click.
export function StatusHistoryGroupLinks({ label, groupId }: StatusHistoryGroupLinksProps) {
  const [open, setOpen] = useState(false);
  const { data: group, isLoading } = useDocumentGroup(groupId, open);
  const docs = group?.documents ?? [];

  return (
    <>
      <Button
        size="small"
        icon={<PaperClipOutlined />}
        loading={open && isLoading}
        onClick={() => setOpen(true)}
      >
        {label}
        {group ? ` (${docs.length})` : ''}
      </Button>
      <DocumentDetailsModal
        open={open && docs.length > 0}
        documents={docs}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
