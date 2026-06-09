import { useEffect, useState } from 'react';
import { Empty, Form, Image, Input, Modal, Switch, Typography, Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import type { VehicleGalleryResponse } from '@volunteerfleet/shared';
import {
  VEHICLE_GALLERY_MAX_ITEMS,
  VEHICLE_GALLERY_PRESENTATION,
  vehicleGalleryCreateSchema,
  vehicleGalleryUpdateSchema,
} from '@volunteerfleet/shared';
import {
  useCreateVehicleGallery,
  useUpdateVehicleGallery,
  useUploadGalleryItem,
} from '../hooks/useVehicleGalleries';
import { vehicleGalleriesApi } from '../api/vehicle-galleries.api';
import { zodToAntdFields } from '../utils/zod-antd';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_UPLOAD_BYTES = 26_214_400;

interface VehicleGalleryModalProps {
  open: boolean;
  vehicleId: string;
  gallery?: VehicleGalleryResponse;
  canMutate: boolean;
  onClose: () => void;
}

interface GalleryFormValues {
  name: string;
  description: string;
  isPublic: boolean;
}

export function VehicleGalleryModal({
  open,
  vehicleId,
  gallery,
  canMutate,
  onClose,
}: VehicleGalleryModalProps) {
  const [form] = Form.useForm<GalleryFormValues>();
  const isEdit = Boolean(gallery);
  const isMain = gallery?.kind === 'main';

  const createGallery = useCreateVehicleGallery(vehicleId);
  const updateGallery = useUpdateVehicleGallery(vehicleId);
  const uploadItem = useUploadGalleryItem(vehicleId);

  const [pendingFiles, setPendingFiles] = useState<UploadFile[]>([]);

  const currentItemCount = gallery?.items.length ?? 0;
  const remainingSlots = VEHICLE_GALLERY_MAX_ITEMS - currentItemCount;

  useEffect(() => {
    if (!open) return;
    setPendingFiles([]);
    if (gallery) {
      form.setFieldsValue({
        name: isMain ? VEHICLE_GALLERY_PRESENTATION.main.label : (gallery.name ?? ''),
        description: gallery.description ?? '',
        isPublic: gallery.isPublic,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ isPublic: false });
    }
  }, [form, gallery, isMain, open]);

  const handleFinish = async (values: GalleryFormValues) => {
    try {
      let targetGalleryId = gallery?.id;

      if (isEdit && gallery) {
        const updatePayload = isMain
          ? { description: values.description.trim() || null }
          : {
              name: values.name.trim(),
              description: values.description.trim() || null,
              isPublic: values.isPublic,
            };
        const parsed = vehicleGalleryUpdateSchema.safeParse(updatePayload);
        if (!parsed.success) {
          form.setFields(zodToAntdFields(parsed.error));
          return;
        }
        await updateGallery.mutateAsync({ galleryId: gallery.id, payload: parsed.data });
      } else {
        const createPayload = {
          name: values.name.trim(),
          description: values.description.trim() || null,
          isPublic: values.isPublic,
        };
        const parsed = vehicleGalleryCreateSchema.safeParse(createPayload);
        if (!parsed.success) {
          form.setFields(zodToAntdFields(parsed.error));
          return;
        }
        const created = await createGallery.mutateAsync(parsed.data);
        targetGalleryId = created.id;
      }

      if (targetGalleryId && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          if (!file.originFileObj) continue;
          const formData = new FormData();
          formData.append('file', file.originFileObj);
          await uploadItem.mutateAsync({ galleryId: targetGalleryId, formData });
        }
      }

      message.success(isEdit ? 'Галерею оновлено' : 'Галерею створено');
      onClose();
    } catch (err: unknown) {
      const resp = (err as { response?: { data?: { code?: string }; status?: number } })?.response;
      if (resp?.data?.code === 'GALLERY_NAME_ALREADY_EXISTS') {
        message.error('Галерея з такою назвою вже існує');
      } else if (resp?.data?.code === 'GALLERY_ITEM_LIMIT_EXCEEDED') {
        message.error(`Максимум ${VEHICLE_GALLERY_MAX_ITEMS} фото у галереї`);
      } else if (resp?.status === 413) {
        message.error('Файл надто великий');
      } else if (resp?.status === 415 || resp?.data?.code === 'UNSUPPORTED_ITEM_TYPE') {
        message.error('Тип файлу не підтримується');
      } else {
        message.error('Помилка збереження');
      }
    }
  };

  const isPending = createGallery.isPending || updateGallery.isPending || uploadItem.isPending;

  const title = isEdit
    ? isMain
      ? `${VEHICLE_GALLERY_PRESENTATION.main.label} — редагування`
      : 'Редагувати галерею'
    : 'Створити галерею';

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      onOk={canMutate ? () => void form.submit() : undefined}
      confirmLoading={isPending}
      destroyOnHidden
      width={640}
      footer={canMutate ? undefined : null}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} disabled={!canMutate}>
        {!isMain && (
          <Form.Item
            name="name"
            label="Назва"
            rules={[{ required: true, message: 'Введіть назву галереї' }]}
          >
            <Input maxLength={255} placeholder="Назва галереї" />
          </Form.Item>
        )}
        <Form.Item name="description" label="Опис">
          <Input.TextArea rows={3} maxLength={2000} showCount placeholder="Опис галереї" />
        </Form.Item>
        {!isMain && (
          <Form.Item name="isPublic" label="Публічна" valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
      </Form>

      {isEdit && gallery && (
        <>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            Фото: {currentItemCount} / {VEHICLE_GALLERY_MAX_ITEMS}
          </Typography.Text>

          {gallery.items.length > 0 ? (
            <Image.PreviewGroup>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {gallery.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: 6,
                      overflow: 'hidden',
                      border: '1px solid #d9d9d9',
                    }}
                  >
                    <Image
                      src={vehicleGalleriesApi.getItemDownloadUrl(vehicleId, gallery.id, item.id)}
                      alt={item.caption ?? item.originalName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {item.caption && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'rgba(0,0,0,0.55)',
                          color: '#fff',
                          fontSize: 11,
                          padding: '2px 6px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.caption}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Image.PreviewGroup>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Фото ще не додано"
              style={{ marginBottom: 16 }}
            />
          )}
        </>
      )}

      {canMutate && (isEdit ? remainingSlots > 0 : true) && (
        <Upload.Dragger
          multiple
          accept={ALLOWED_MIME_TYPES.join(',')}
          beforeUpload={(file, fileList) => {
            if (!ALLOWED_MIME_TYPES.includes(file.type)) {
              message.error('Підтримуються лише JPG, PNG, WebP або HEIC');
              return Upload.LIST_IGNORE;
            }
            if (file.size > MAX_UPLOAD_BYTES) {
              message.error('Файл перевищує 25 МБ');
              return Upload.LIST_IGNORE;
            }
            const totalAfter = currentItemCount + pendingFiles.length + fileList.indexOf(file) + 1;
            if (isEdit && totalAfter > VEHICLE_GALLERY_MAX_ITEMS) {
              message.error(`Максимум ${VEHICLE_GALLERY_MAX_ITEMS} фото у галереї`);
              return Upload.LIST_IGNORE;
            }
            return false;
          }}
          fileList={pendingFiles}
          onChange={({ fileList }) => setPendingFiles(fileList)}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Натисніть або перетягніть фото</p>
          {isEdit && (
            <p className="ant-upload-hint">
              Залишилось місць: {Math.max(0, remainingSlots - pendingFiles.length)}
            </p>
          )}
        </Upload.Dragger>
      )}
    </Modal>
  );
}
