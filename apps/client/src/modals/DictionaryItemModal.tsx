import { useEffect } from 'react';
import { Form, Input, InputNumber, Modal, message } from 'antd';
import type { FinancialCategory } from '@volunteerfleet/shared';
import {
  financialCategoryCreateSchema,
  financialCategoryUpdateSchema,
} from '@volunteerfleet/shared';
import type { DictionaryType } from '../api/dictionaries.api';
import { useCreateDictionaryItem, useUpdateDictionaryItem } from '../hooks/useDictionaries';
import { zodToAntdFields, zodValidator } from '../utils/zod-antd';

type DictionaryItem = FinancialCategory;

interface DictionaryItemModalProps {
  open: boolean;
  type: DictionaryType;
  item?: DictionaryItem;
  onClose: () => void;
}

interface DictionaryFormValues {
  name: string;
  sortOrder?: number;
}

function schemaFor(isEdit: boolean) {
  return isEdit ? financialCategoryUpdateSchema : financialCategoryCreateSchema;
}

function sortOrderSchema() {
  return financialCategoryCreateSchema.shape.sortOrder;
}

export function DictionaryItemModal({ open, type, item, onClose }: DictionaryItemModalProps) {
  const [form] = Form.useForm<DictionaryFormValues>();
  const createItem = useCreateDictionaryItem(type);
  const updateItem = useUpdateDictionaryItem(type);
  const isEdit = Boolean(item);

  useEffect(() => {
    if (!open) return;
    if (item) {
      form.setFieldsValue(item as DictionaryFormValues);
    } else {
      form.setFieldsValue({
        sortOrder: 0,
      });
    }
  }, [form, item, open, type]);

  const handleFinish = async (values: DictionaryFormValues) => {
    const parsed = schemaFor(isEdit).safeParse(values);
    if (!parsed.success) {
      form.setFields(zodToAntdFields(parsed.error));
      return;
    }

    try {
      if (isEdit && item) {
        await updateItem.mutateAsync({ id: item.id, payload: parsed.data });
        message.success('Елемент оновлено');
      } else {
        await createItem.mutateAsync(parsed.data);
        message.success('Елемент створено');
      }
      onClose();
    } catch {
      message.error('Не вдалося зберегти елемент довідника');
    }
  };

  return (
    <Modal
      title={isEdit ? 'Редагувати фінансову категорію' : 'Додати фінансову категорію'}
      open={open}
      onCancel={onClose}
      onOk={() => void form.submit()}
      confirmLoading={createItem.isPending || updateItem.isPending}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" validateTrigger="onBlur" onFinish={handleFinish}>
        <Form.Item
          name="name"
          label="Назва"
          rules={[{ validator: zodValidator(financialCategoryCreateSchema.shape.name) }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="sortOrder"
          label="Порядок"
          rules={[{ validator: zodValidator(sortOrderSchema()) }]}
        >
          <InputNumber min={0} max={32767} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
