import { useEffect, useState } from 'react';
import {
  Button,
  Empty,
  Form,
  Image,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  CheckCircleTwoTone,
  DeleteOutlined,
  EditOutlined,
  InboxOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import type { VehicleGalleryItemResponse, VehicleGalleryResponse } from '@volunteerfleet/shared';
import {
  VEHICLE_GALLERY_MAX_ITEMS,
  VEHICLE_GALLERY_PRESENTATION,
  vehicleGalleryCreateSchema,
  vehicleGalleryUpdateSchema,
} from '@volunteerfleet/shared';
import {
  useCreateVehicleGallery,
  useDeleteGalleryItem,
  useMoveGalleryItem,
  useReorderGalleryItems,
  useSetGalleryCover,
  useUpdateGalleryItemCaption,
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
  allGalleries: VehicleGalleryResponse[];
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
  allGalleries,
  canMutate,
  onClose,
}: VehicleGalleryModalProps) {
  const [form] = Form.useForm<GalleryFormValues>();
  const isEdit = Boolean(gallery);
  const isMain = gallery?.kind === 'main';

  const createGallery = useCreateVehicleGallery(vehicleId);
  const updateGallery = useUpdateVehicleGallery(vehicleId);
  const uploadItem = useUploadGalleryItem(vehicleId);
  const updateCaption = useUpdateGalleryItemCaption(vehicleId);
  const reorderItems = useReorderGalleryItems(vehicleId);
  const setCover = useSetGalleryCover(vehicleId);
  const moveItem = useMoveGalleryItem(vehicleId);
  const deleteItem = useDeleteGalleryItem(vehicleId);

  const [pendingFiles, setPendingFiles] = useState<UploadFile[]>([]);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const [moveTargetGalleryId, setMoveTargetGalleryId] = useState<string | null>(null);

  const currentItemCount = gallery?.items.length ?? 0;
  const remainingSlots = VEHICLE_GALLERY_MAX_ITEMS - currentItemCount;

  useEffect(() => {
    if (!open) return;
    setPendingFiles([]);
    setEditingCaptionId(null);
    setMovingItemId(null);
    setMoveTargetGalleryId(null);
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
      handleApiError(err);
    }
  };

  const handleCaptionSave = async (item: VehicleGalleryItemResponse) => {
    if (!gallery) return;
    try {
      await updateCaption.mutateAsync({
        galleryId: gallery.id,
        itemId: item.id,
        payload: { caption: captionDraft.trim() || null },
      });
      setEditingCaptionId(null);
      message.success('Підпис оновлено');
    } catch (err: unknown) {
      handleApiError(err);
    }
  };

  const handleReorder = async (itemIndex: number, direction: -1 | 1) => {
    if (!gallery) return;
    const items = [...gallery.items];
    const targetIndex = itemIndex + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const temp = items[itemIndex]!;
    items[itemIndex] = items[targetIndex]!;
    items[targetIndex] = temp;
    try {
      await reorderItems.mutateAsync({
        galleryId: gallery.id,
        payload: { itemIds: items.map((it) => it.id) },
      });
    } catch (err: unknown) {
      handleApiError(err);
    }
  };

  const handleSetCover = async (itemId: string | null) => {
    if (!gallery) return;
    try {
      await setCover.mutateAsync({
        galleryId: gallery.id,
        payload: { itemId },
      });
      message.success(itemId ? 'Обкладинку встановлено' : 'Обкладинку скинуто');
    } catch (err: unknown) {
      handleApiError(err);
    }
  };

  const handleMove = async (itemId: string) => {
    if (!gallery || !moveTargetGalleryId) return;
    try {
      await moveItem.mutateAsync({
        galleryId: gallery.id,
        itemId,
        payload: { targetGalleryId: moveTargetGalleryId },
      });
      setMovingItemId(null);
      setMoveTargetGalleryId(null);
      message.success('Фото переміщено');
    } catch (err: unknown) {
      handleApiError(err);
    }
  };

  const handleDeleteItem = async (item: VehicleGalleryItemResponse) => {
    if (!gallery) return;
    try {
      await deleteItem.mutateAsync({ galleryId: gallery.id, itemId: item.id });
      message.success('Фото видалено');
    } catch (err: unknown) {
      handleApiError(err);
    }
  };

  const isMutating =
    createGallery.isPending ||
    updateGallery.isPending ||
    uploadItem.isPending ||
    updateCaption.isPending ||
    reorderItems.isPending ||
    setCover.isPending ||
    moveItem.isPending ||
    deleteItem.isPending;

  const title = isEdit
    ? isMain
      ? `${VEHICLE_GALLERY_PRESENTATION.main.label} — редагування`
      : 'Редагувати галерею'
    : 'Створити галерею';

  const moveTargetOptions = allGalleries
    .filter((g) => g.id !== gallery?.id)
    .map((g) => ({
      value: g.id,
      label: g.kind === 'main' ? VEHICLE_GALLERY_PRESENTATION.main.label : (g.name ?? ''),
      disabled: g.items.length >= VEHICLE_GALLERY_MAX_ITEMS,
    }));

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      onOk={canMutate ? () => void form.submit() : undefined}
      confirmLoading={isMutating}
      destroyOnHidden
      width={720}
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
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {gallery.items.map((item, index) => {
                  const isExplicitCover = gallery.explicitCoverItemId === item.id;
                  const isEffectiveCover = gallery.effectiveCoverItemId === item.id;
                  const isEditingCaption = editingCaptionId === item.id;
                  const isMoving = movingItemId === item.id;

                  return (
                    <div
                      key={item.id}
                      style={{
                        border: isExplicitCover
                          ? '2px solid #1677ff'
                          : isEffectiveCover
                            ? '2px dashed #1677ff'
                            : '1px solid #d9d9d9',
                        borderRadius: 8,
                        overflow: 'hidden',
                        background: '#fff',
                      }}
                    >
                      <div style={{ position: 'relative', aspectRatio: '4 / 3' }}>
                        <Image
                          src={vehicleGalleriesApi.getItemDownloadUrl(
                            vehicleId,
                            gallery.id,
                            item.id,
                          )}
                          alt={item.caption ?? item.originalName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {isEffectiveCover && (
                          <Tag
                            color="blue"
                            style={{ position: 'absolute', top: 4, left: 4, margin: 0 }}
                          >
                            {isExplicitCover ? 'Обкладинка' : 'Обкладинка (авто)'}
                          </Tag>
                        )}
                      </div>

                      <div style={{ padding: '6px 8px' }}>
                        {isEditingCaption ? (
                          <Space.Compact style={{ width: '100%', marginBottom: 4 }}>
                            <Input
                              size="small"
                              value={captionDraft}
                              onChange={(e) => setCaptionDraft(e.target.value)}
                              maxLength={2000}
                              placeholder="Підпис"
                              onPressEnter={() => void handleCaptionSave(item)}
                              autoFocus
                            />
                            <Button
                              size="small"
                              type="primary"
                              loading={updateCaption.isPending}
                              onClick={() => void handleCaptionSave(item)}
                            >
                              OK
                            </Button>
                            <Button size="small" onClick={() => setEditingCaptionId(null)}>
                              X
                            </Button>
                          </Space.Compact>
                        ) : (
                          <Typography.Text
                            type="secondary"
                            ellipsis
                            style={{ fontSize: 12, display: 'block', marginBottom: 4 }}
                            title={item.caption ?? undefined}
                          >
                            {item.caption || '—'}
                          </Typography.Text>
                        )}

                        {isMoving && (
                          <Space.Compact style={{ width: '100%', marginBottom: 4 }}>
                            <Select
                              size="small"
                              style={{ flex: 1 }}
                              placeholder="Оберіть галерею"
                              options={moveTargetOptions}
                              value={moveTargetGalleryId}
                              onChange={setMoveTargetGalleryId}
                            />
                            <Button
                              size="small"
                              type="primary"
                              disabled={!moveTargetGalleryId}
                              loading={moveItem.isPending}
                              onClick={() => void handleMove(item.id)}
                            >
                              OK
                            </Button>
                            <Button
                              size="small"
                              onClick={() => {
                                setMovingItemId(null);
                                setMoveTargetGalleryId(null);
                              }}
                            >
                              X
                            </Button>
                          </Space.Compact>
                        )}

                        {canMutate && !isEditingCaption && !isMoving && (
                          <Space wrap size={4}>
                            <Tooltip title="Редагувати підпис">
                              <Button
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => {
                                  setCaptionDraft(item.caption ?? '');
                                  setEditingCaptionId(item.id);
                                }}
                                aria-label="Редагувати підпис"
                              />
                            </Tooltip>
                            {index > 0 && (
                              <Tooltip title="Вгору">
                                <Button
                                  size="small"
                                  icon={<ArrowUpOutlined />}
                                  loading={reorderItems.isPending}
                                  onClick={() => void handleReorder(index, -1)}
                                  aria-label="Перемістити вгору"
                                />
                              </Tooltip>
                            )}
                            {index < gallery.items.length - 1 && (
                              <Tooltip title="Вниз">
                                <Button
                                  size="small"
                                  icon={<ArrowDownOutlined />}
                                  loading={reorderItems.isPending}
                                  onClick={() => void handleReorder(index, 1)}
                                  aria-label="Перемістити вниз"
                                />
                              </Tooltip>
                            )}
                            <Tooltip
                              title={
                                isExplicitCover ? 'Скинути обкладинку' : 'Встановити обкладинкою'
                              }
                            >
                              <Button
                                size="small"
                                icon={
                                  isExplicitCover ? (
                                    <CheckCircleTwoTone twoToneColor="#1677ff" />
                                  ) : (
                                    <CheckCircleOutlined />
                                  )
                                }
                                loading={setCover.isPending}
                                onClick={() =>
                                  void handleSetCover(isExplicitCover ? null : item.id)
                                }
                                aria-label={
                                  isExplicitCover ? 'Скинути обкладинку' : 'Встановити обкладинкою'
                                }
                              />
                            </Tooltip>
                            {moveTargetOptions.length > 0 && (
                              <Tooltip title="Перемістити в іншу галерею">
                                <Button
                                  size="small"
                                  icon={<SwapOutlined />}
                                  onClick={() => {
                                    setMovingItemId(item.id);
                                    setMoveTargetGalleryId(null);
                                  }}
                                  disabled={
                                    remainingSlots <= 0 &&
                                    moveTargetOptions.every((o) => o.disabled)
                                  }
                                  aria-label="Перемістити в іншу галерею"
                                />
                              </Tooltip>
                            )}
                            <Popconfirm
                              title="Видалити фото?"
                              okText="Видалити"
                              cancelText="Скасувати"
                              onConfirm={() => void handleDeleteItem(item)}
                            >
                              <Tooltip title="Видалити">
                                <Button
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  aria-label="Видалити фото"
                                />
                              </Tooltip>
                            </Popconfirm>
                          </Space>
                        )}
                      </div>
                    </div>
                  );
                })}
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

function handleApiError(err: unknown) {
  const resp = (err as { response?: { data?: { code?: string }; status?: number } })?.response;
  if (resp?.data?.code === 'GALLERY_NAME_ALREADY_EXISTS') {
    message.error('Галерея з такою назвою вже існує');
  } else if (resp?.data?.code === 'GALLERY_ITEM_LIMIT_EXCEEDED') {
    message.error(`Максимум ${VEHICLE_GALLERY_MAX_ITEMS} фото у галереї`);
  } else if (resp?.data?.code === 'MOVE_TARGET_MUST_DIFFER_FROM_SOURCE') {
    message.error('Не можна перемістити у ту саму галерею');
  } else if (resp?.data?.code === 'TARGET_GALLERY_NOT_FOUND') {
    message.error('Цільову галерею не знайдено');
  } else if (resp?.status === 413) {
    message.error('Файл надто великий');
  } else if (resp?.status === 415 || resp?.data?.code === 'UNSUPPORTED_ITEM_TYPE') {
    message.error('Тип файлу не підтримується');
  } else {
    message.error('Помилка збереження');
  }
}
