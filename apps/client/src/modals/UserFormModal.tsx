import { useEffect } from 'react';
import { Form, Input, Modal, Select, Switch, message } from 'antd';
import type { Role, UserCreate, UserResponse } from '@volunteerfleet/shared';
import { userCreateSchema, userUpdateSchema } from '@volunteerfleet/shared';
import { useCreateUser, useUpdateUser } from '../hooks/useUsers';
import { zodToAntdFields, zodValidator } from '../utils/zod-antd';

interface UserFormModalProps {
  open: boolean;
  user?: UserResponse;
  onClose: () => void;
  onGeneratedPassword?: (password: string) => void;
}

interface UserFormValues {
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
}

export function UserFormModal({ open, user, onClose, onGeneratedPassword }: UserFormModalProps) {
  const [form] = Form.useForm<UserFormValues>();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const isEdit = Boolean(user);

  useEffect(() => {
    if (!open) return;
    if (user) {
      form.setFieldsValue({
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
      });
    } else {
      form.setFieldsValue({ role: 'user', isActive: true });
    }
  }, [form, open, user]);

  const handleFinish = async (values: UserFormValues) => {
    const parsed = (isEdit ? userUpdateSchema : userCreateSchema).safeParse(values);
    if (!parsed.success) {
      form.setFields(zodToAntdFields(parsed.error));
      return;
    }

    try {
      if (isEdit && user) {
        await updateUser.mutateAsync({ id: user.id, payload: parsed.data });
        message.success('Користувача оновлено');
      } else {
        const result = await createUser.mutateAsync(parsed.data as UserCreate);
        if (result.generatedPassword) onGeneratedPassword?.(result.generatedPassword);
        message.success('Користувача створено');
      }
      onClose();
    } catch {
      message.error('Не вдалося зберегти користувача');
    }
  };

  return (
    <Modal
      title={isEdit ? 'Редагувати користувача' : 'Додати користувача'}
      open={open}
      onCancel={onClose}
      onOk={() => void form.submit()}
      confirmLoading={createUser.isPending || updateUser.isPending}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" validateTrigger="onBlur" onFinish={handleFinish}>
        <Form.Item
          name="email"
          label="Email"
          rules={[{ validator: zodValidator(userCreateSchema.shape.email) }]}
        >
          <Input disabled={isEdit} />
        </Form.Item>
        <Form.Item
          name="fullName"
          label="ПІБ"
          rules={[{ validator: zodValidator(userCreateSchema.shape.fullName) }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="role"
          label="Роль"
          rules={[{ validator: zodValidator(userCreateSchema.shape.role) }]}
        >
          <Select
            options={[
              { value: 'superuser', label: 'Суперкористувач' },
              { value: 'user', label: 'Користувач' },
            ]}
          />
        </Form.Item>
        <Form.Item name="isActive" label="Активний" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
