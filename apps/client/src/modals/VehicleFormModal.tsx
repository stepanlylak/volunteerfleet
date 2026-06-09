import { useEffect } from 'react';
import { DatePicker, Form, Input, InputNumber, Modal, message } from 'antd';
import dayjs from 'dayjs';
import {
  vehicleCreateSchema,
  vehicleUpdateSchema,
  type VehicleCreate,
  type VehicleResponse,
} from '@volunteerfleet/shared';
import { useCreateVehicle, useUpdateVehicle, useVehicle } from '../hooks/useVehicles';
import { zodToAntdFields, zodValidator } from '../utils/zod-antd';

interface VehicleFormModalProps {
  open: boolean;
  vehicleId?: string;
  onClose: () => void;
  onCreated?: (vehicle: VehicleResponse) => void;
}

type VehicleFormValues = Omit<VehicleCreate, 'startDate'> & {
  startDate: dayjs.Dayjs;
};

function optionalText(value: string | null | undefined) {
  return value?.trim() ? value.trim() : null;
}

export function VehicleFormModal({ open, vehicleId, onClose, onCreated }: VehicleFormModalProps) {
  const [form] = Form.useForm<VehicleFormValues>();
  const isEdit = Boolean(vehicleId);
  const { data: vehicle } = useVehicle(open && vehicleId ? vehicleId : undefined, true);
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();

  useEffect(() => {
    if (!open) return;
    if (!vehicleId) {
      form.resetFields();
      form.setFieldValue('startDate', dayjs());
      return;
    }
    if (vehicle) {
      form.setFieldsValue({
        identifier: vehicle.identifier,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        vin: vehicle.vin,
        startDate: dayjs(vehicle.startDate),
        description: vehicle.description,
      });
    }
  }, [form, open, vehicle, vehicleId]);

  const handleFinish = async (values: VehicleFormValues) => {
    const normalized = {
      ...values,
      year: values.year ?? null,
      vin: optionalText(values.vin),
      startDate: values.startDate.format('YYYY-MM-DD'),
      description: optionalText(values.description),
    };
    const parsed = (isEdit ? vehicleUpdateSchema : vehicleCreateSchema).safeParse(normalized);

    if (!parsed.success) {
      form.setFields(zodToAntdFields(parsed.error));
      return;
    }

    try {
      if (isEdit && vehicleId) {
        await updateVehicle.mutateAsync({ id: vehicleId, payload: parsed.data });
        message.success('Авто оновлено');
      } else {
        const savedVehicle = await createVehicle.mutateAsync(parsed.data as VehicleCreate);
        message.success('Авто створено');
        onCreated?.(savedVehicle);
      }
      onClose();
    } catch {
      message.error('Не вдалося зберегти авто');
    }
  };

  const isPending = createVehicle.isPending || updateVehicle.isPending;

  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal
      title={isEdit ? 'Редагувати авто' : 'Додати авто'}
      open={open}
      onCancel={handleCancel}
      onOk={() => void form.submit()}
      confirmLoading={isPending}
      destroyOnHidden
      width={640}
    >
      <Form form={form} layout="vertical" validateTrigger="onBlur" onFinish={handleFinish}>
        <Form.Item
          name="identifier"
          label="Ідентифікатор"
          rules={[{ validator: zodValidator(vehicleCreateSchema.shape.identifier) }]}
        >
          <Input placeholder="VHC-001" />
        </Form.Item>
        <Form.Item
          name="brand"
          label="Марка"
          rules={[{ validator: zodValidator(vehicleCreateSchema.shape.brand) }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="model"
          label="Модель"
          rules={[{ validator: zodValidator(vehicleCreateSchema.shape.model) }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="year"
          label="Рік"
          rules={[{ validator: zodValidator(vehicleCreateSchema.shape.year) }]}
        >
          <InputNumber min={1900} max={2100} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="vin"
          label="VIN"
          rules={[{ validator: zodValidator(vehicleCreateSchema.shape.vin) }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="startDate"
          label="Початкова дата"
          rules={[{ required: true, message: 'Вкажіть початкову дату' }]}
        >
          <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
        </Form.Item>
        <Form.Item
          name="description"
          label="Опис"
          rules={[{ validator: zodValidator(vehicleCreateSchema.shape.description) }]}
        >
          <Input.TextArea rows={4} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
