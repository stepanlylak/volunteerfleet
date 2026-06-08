import { useEffect } from 'react';
import { Form, Input, Modal, Switch, message } from 'antd';
import type {
  OrganizationResponse,
  OrganizationCreate,
  OrganizationUpdate,
} from '@volunteerfleet/shared';
import { useCreateOrganization, useUpdateOrganization } from '../hooks/useOrganizations';

interface Props {
  open: boolean;
  organization?: OrganizationResponse;
  onClose: () => void;
}

export function OrganizationFormModal({ open, organization, onClose }: Props) {
  const [form] = Form.useForm<OrganizationCreate | OrganizationUpdate>();
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();
  const isEdit = !!organization;

  useEffect(() => {
    if (open) {
      if (organization) {
        form.setFieldsValue({
          name: organization.name,
          description: organization.description,
          isActive: organization.isActive,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ isActive: true });
      }
    }
  }, [open, organization, form]);

  const handleSubmit = async (values: OrganizationCreate | OrganizationUpdate) => {
    try {
      if (isEdit) {
        await updateOrg.mutateAsync({ id: organization.id, data: values as OrganizationUpdate });
        message.success('Організацію оновлено');
      } else {
        await createOrg.mutateAsync(values as OrganizationCreate);
        message.success('Організацію створено');
      }
      onClose();
    } catch {
      message.error('Сталася помилка при збереженні');
    }
  };

  return (
    <Modal
      title={isEdit ? 'Редагувати організацію' : 'Нова організація'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={createOrg.isPending || updateOrg.isPending}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="name"
          label="Назва"
          rules={[{ required: true, message: 'Введіть назву організації' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="description" label="Опис">
          <Input.TextArea rows={4} />
        </Form.Item>
        <Form.Item name="isActive" label="Активна" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
