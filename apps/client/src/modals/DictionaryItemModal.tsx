import { useEffect } from 'react';
import { Form, Input, InputNumber, Modal, Select, message } from 'antd';
import type { ExpenseCategory, FundingSource } from '@volunteerfleet/shared';
import {
  expenseCategoryCreateSchema,
  expenseCategoryUpdateSchema,
  fundingSourceCreateSchema,
  fundingSourceUpdateSchema,
} from '@volunteerfleet/shared';
import type { DictionaryType } from '../api/dictionaries.api';
import { useCreateDictionaryItem, useUpdateDictionaryItem } from '../hooks/useDictionaries';
import { zodToAntdFields, zodValidator } from '../utils/zod-antd';

type DictionaryItem = ExpenseCategory | FundingSource;

interface DictionaryItemModalProps {
  open: boolean;
  type: DictionaryType;
  item?: DictionaryItem;
  onClose: () => void;
}

interface DictionaryFormValues {
  name: string;
  sortOrder?: number;
  isDefault?: boolean;
  type?: 'donor' | 'fundraiser' | 'initiative' | 'other';
  description?: string | null;
}

function schemaFor(type: DictionaryType, isEdit: boolean) {
  if (type === 'expense-categories') {
    return isEdit ? expenseCategoryUpdateSchema : expenseCategoryCreateSchema;
  }
  return isEdit ? fundingSourceUpdateSchema : fundingSourceCreateSchema;
}

function titleFor(type: DictionaryType) {
  if (type === 'expense-categories') return 'категорію витрат';
  return 'джерело фінансування';
}

function sortOrderSchema() {
  return expenseCategoryCreateSchema.shape.sortOrder;
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
        type: 'donor',
        description: null,
      });
    }
  }, [form, item, open, type]);

  const handleFinish = async (values: DictionaryFormValues) => {
    const payload = {
      ...values,
      description: values.description?.trim() ? values.description.trim() : null,
    };
    const parsed = schemaFor(type, isEdit).safeParse(payload);
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
      title={isEdit ? `Редагувати ${titleFor(type)}` : `Додати ${titleFor(type)}`}
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
          rules={[{ validator: zodValidator(schemaFor(type, false).shape.name) }]}
        >
          <Input />
        </Form.Item>
        {type !== 'funding-sources' ? (
          <Form.Item
            name="sortOrder"
            label="Порядок"
            rules={[{ validator: zodValidator(sortOrderSchema()) }]}
          >
            <InputNumber min={0} max={32767} style={{ width: '100%' }} />
          </Form.Item>
        ) : null}
        {type === 'funding-sources' ? (
          <>
            <Form.Item
              name="type"
              label="Тип"
              rules={[{ validator: zodValidator(fundingSourceCreateSchema.shape.type) }]}
            >
              <Select
                options={[
                  { value: 'donor', label: 'Донор' },
                  { value: 'fundraiser', label: 'Збір' },
                  { value: 'initiative', label: 'Ініціатива' },
                  { value: 'other', label: 'Інше' },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="description"
              label="Опис"
              rules={[{ validator: zodValidator(fundingSourceCreateSchema.shape.description) }]}
            >
              <Input.TextArea rows={3} />
            </Form.Item>
          </>
        ) : null}
      </Form>
    </Modal>
  );
}
