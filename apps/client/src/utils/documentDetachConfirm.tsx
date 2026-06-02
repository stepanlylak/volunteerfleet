import { Button, Modal, Space, Typography } from 'antd';

export type DocumentDetachAction = 'delete' | 'unlink';

interface ConfirmDocumentDetachOptions {
  count: number;
  title: string;
  description: string;
}

export function confirmDocumentDetachAction({
  count,
  title,
  description,
}: ConfirmDocumentDetachOptions): Promise<DocumentDetachAction | null> {
  return new Promise((resolve) => {
    let modal: ReturnType<typeof Modal.confirm> | null = null;
    let settled = false;

    const finish = (action: DocumentDetachAction | null) => {
      if (settled) return;
      settled = true;
      modal?.destroy();
      resolve(action);
    };

    modal = Modal.confirm({
      title,
      content: (
        <Space direction="vertical" size="middle">
          <Typography.Text>{description}</Typography.Text>
          <Typography.Text type="secondary">
            Документів: {count}.<br />
            Можна залишити їх у загальних документах авто або видалити повністю.
          </Typography.Text>
        </Space>
      ),
      okText: 'Залишити',
      cancelText: 'Скасувати',
      onOk: () => finish('unlink'),
      onCancel: () => finish(null),
      footer: (_, { OkBtn, CancelBtn }) => (
        <>
          <CancelBtn />
          <Button danger onClick={() => finish('delete')}>
            Видалити
          </Button>
          <OkBtn />
        </>
      ),
    });
  });
}
