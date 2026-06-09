import { useEffect, useState } from 'react';
import { DatePicker, Form, Input, InputNumber, Modal, Select, message } from 'antd';
import dayjs from 'dayjs';
import {
  vehicleCreateSchema,
  vehicleUpdateSchema,
  VEHICLE_STATUS_CONFIG,
  VEHICLE_STATUSES,
  type VehicleCreate,
  type VehicleResponse,
} from '@volunteerfleet/shared';
import { vehiclesApi } from '../api/vehicles.api';
import {
  FileAttachmentField,
  type FileAttachmentExistingItem,
  type FileAttachmentNewFile,
} from '../components/files/FileAttachmentField';
import {
  useCreateVehicle,
  useDeleteVehiclePhotoForVehicle,
  useUpdateVehicle,
  useUploadVehiclePhotoForVehicle,
  useVehicle,
  useVehiclePhotos,
} from '../hooks/useVehicles';
import { zodToAntdFields, zodValidator } from '../utils/zod-antd';

interface VehicleFormModalProps {
  open: boolean;
  vehicleId?: string;
  onClose: () => void;
  onCreated?: (vehicle: VehicleResponse) => void;
}

type VehicleFormValues = Omit<VehicleCreate, 'borderCrossingDate'> & {
  borderCrossingDate?: dayjs.Dayjs | null;
};

const MAX_PHOTO_SIZE_BYTES = 26_214_400;
const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

function optionalText(value: string | null | undefined) {
  return value?.trim() ? value.trim() : null;
}

export function VehicleFormModal({ open, vehicleId, onClose, onCreated }: VehicleFormModalProps) {
  const [form] = Form.useForm<VehicleFormValues>();
  const isEdit = Boolean(vehicleId);
  const { data: vehicle, isFetching } = useVehicle(open && vehicleId ? vehicleId : undefined, true);
  const { data: photosData, isLoading: photosLoading } = useVehiclePhotos(
    open && vehicleId ? vehicleId : undefined,
  );
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const uploadPhoto = useUploadVehiclePhotoForVehicle();
  const deletePhoto = useDeleteVehiclePhotoForVehicle();
  const [newPhotoFiles, setNewPhotoFiles] = useState<FileAttachmentNewFile[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setNewPhotoFiles([]);
    setRemovedPhotoIds([]);
    if (!vehicleId) {
      form.resetFields();
      return;
    }
    if (vehicle) {
      form.setFieldsValue({
        identifier: vehicle.identifier,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        vin: vehicle.vin,
        borderCrossingDate: vehicle.borderCrossingDate ? dayjs(vehicle.borderCrossingDate) : null,
        status: vehicle.status,
        description: vehicle.description,
      });
    }
  }, [form, open, vehicle, vehicleId]);

  const photos = photosData?.items ?? [];
  const visiblePhotoCount = photos.filter((photo) => !removedPhotoIds.includes(photo.id)).length;
  const photoItems: FileAttachmentExistingItem[] = photos.map((photo, index) => ({
    id: photo.id,
    name: `Фото ${index + 1}`,
    kind: 'photo',
    mimeType: photo.mimeType,
    sizeBytes: photo.sizeBytes,
    previewUrl: vehicleId ? vehiclesApi.getPhotoDownloadUrl(vehicleId, photo.id) : undefined,
    downloadUrl: vehicleId ? vehiclesApi.getPhotoDownloadUrl(vehicleId, photo.id) : undefined,
  }));

  const handleFinish = async (values: VehicleFormValues) => {
    const normalized = {
      ...values,
      year: values.year ?? null,
      vin: optionalText(values.vin),
      borderCrossingDate: values.borderCrossingDate?.format('YYYY-MM-DD') ?? null,
      description: optionalText(values.description),
    };
    const parsed = (isEdit ? vehicleUpdateSchema : vehicleCreateSchema).safeParse(normalized);

    if (!parsed.success) {
      form.setFields(zodToAntdFields(parsed.error));
      return;
    }

    try {
      let savedVehicle: VehicleResponse;
      if (isEdit && vehicleId) {
        savedVehicle = await updateVehicle.mutateAsync({ id: vehicleId, payload: parsed.data });
        await syncPhotos(savedVehicle.id, visiblePhotoCount);
        message.success('Авто оновлено');
      } else {
        savedVehicle = await createVehicle.mutateAsync(parsed.data as VehicleCreate);
        await syncPhotos(savedVehicle.id, 0);
        message.success('Авто створено');
        onCreated?.(savedVehicle);
      }
      setNewPhotoFiles([]);
      setRemovedPhotoIds([]);
      onClose();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 400) message.error('Перевищено ліміт 10 фото');
      else if (status === 413) message.error('Фото надто велике');
      else if (status === 415) message.error('Тип фото не підтримується');
      else message.error('Не вдалося зберегти авто');
    }
  };

  const syncPhotos = async (targetVehicleId: string, nextSortOrderStart: number) => {
    for (const photoId of removedPhotoIds) {
      await deletePhoto.mutateAsync({ vehicleId: targetVehicleId, photoId });
    }

    for (const [index, item] of newPhotoFiles.entries()) {
      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('sortOrder', String(nextSortOrderStart + index));
      await uploadPhoto.mutateAsync({ vehicleId: targetVehicleId, formData });
    }
  };

  const isPending =
    createVehicle.isPending ||
    updateVehicle.isPending ||
    uploadPhoto.isPending ||
    deletePhoto.isPending;

  const handleCancel = () => {
    setNewPhotoFiles([]);
    setRemovedPhotoIds([]);
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
        <Form.Item name="borderCrossingDate" label="Дата перетину кордону">
          <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
        </Form.Item>
        <Form.Item
          name="status"
          label="Статус"
          rules={[{ validator: zodValidator(vehicleCreateSchema.shape.status) }]}
        >
          <Select>
            options={(dictionaries?.vehicleStatuses ?? []).map((status) => ({
              value: status.id,
              label: status.name,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="description"
          label="Опис"
          rules={[{ validator: zodValidator(vehicleCreateSchema.shape.description) }]}
        >
          <Input.TextArea rows={4} />
        </Form.Item>
        <Form.Item label="Фото автомобіля">
          <FileAttachmentField
            acceptedMimeTypes={ALLOWED_PHOTO_MIME_TYPES}
            allowLinks={false}
            editableNewFileNames={false}
            emptyText="Фото авто ще не додано"
            existingItems={isEdit ? photoItems : []}
            getNewFileDisplayName={(_item, index, existingFileCount) =>
              `Фото ${existingFileCount + index + 1}`
            }
            loading={photosLoading}
            maxFiles={10}
            maxFilesErrorMessage="Можна додати не більше 10 фото авто"
            maxSizeBytes={MAX_PHOTO_SIZE_BYTES}
            maxSizeErrorMessage="Фото перевищує 25 МБ"
            mimeTypeErrorMessage="Підтримуються лише JPG, PNG, WebP або HEIC"
            newFiles={newPhotoFiles}
            onNewFilesChange={setNewPhotoFiles}
            removedExistingIds={removedPhotoIds}
            onRemovedExistingIdsChange={setRemovedPhotoIds}
            uploadHint="JPG, PNG, WebP або HEIC — до 25 МБ, максимум 10 фото"
            uploadText="Натисніть або перетягніть фото"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
