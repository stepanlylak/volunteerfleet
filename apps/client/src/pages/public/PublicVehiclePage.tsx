import {
  Card,
  Descriptions,
  Empty,
  Image,
  Progress,
  Result,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { PublicVehicleGallery } from '@volunteerfleet/shared';
import { VEHICLE_GALLERY_PRESENTATION } from '@volunteerfleet/shared';
import { publicApi } from '../../api/public.api';
import { formatCurrency, formatDate } from '../../utils/format';

function GallerySection({ gallery }: { gallery: PublicVehicleGallery }) {
  // Don't render empty galleries
  if (gallery.items.length === 0) {
    return null;
  }

  const title =
    gallery.kind === 'main' ? VEHICLE_GALLERY_PRESENTATION.main.label : (gallery.name ?? 'Галерея');

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 8 }}>
        {title}
      </Typography.Title>
      {gallery.description && (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          {gallery.description}
        </Typography.Paragraph>
      )}
      <Image.PreviewGroup>
        <Space wrap size="middle">
          {gallery.items.map((item) => (
            <Image
              key={item.id}
              width={220}
              height={150}
              style={{ objectFit: 'cover' }}
              src={publicApi.getGalleryItemDownloadUrl(item.id)}
              alt={item.caption ?? title}
            />
          ))}
        </Space>
      </Image.PreviewGroup>
    </div>
  );
}

export function PublicVehiclePage() {
  const { orgId, vehicleId } = useParams<{ orgId: string; vehicleId: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public', 'vehicle', orgId, vehicleId],
    queryFn: () => publicApi.getVehicle(orgId!, vehicleId!),
    enabled: Boolean(orgId && vehicleId),
    retry: false,
  });

  if (isLoading) return <Skeleton active />;
  if (isError || !data) {
    return <Result status="404" title="Сторінка не знайдена або недоступна" />;
  }

  const hasGoal = Boolean(data.publicGoalAmountUahMinor);
  const progress = hasGoal
    ? Math.min(
        100,
        Math.round(
          ((data.publicCollectedAmountUahMinor ?? 0) / data.publicGoalAmountUahMinor!) * 100,
        ),
      )
    : null;

  // Filter out empty galleries and sort by sortOrder
  const visibleGalleries = data.galleries
    .filter((g) => g.items.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={1}>
          {data.brand} {data.model}
        </Typography.Title>
        <Space wrap>
          <Tag color="blue">{data.status.name}</Tag>
          <Typography.Text>{data.identifier}</Typography.Text>
          <Typography.Text>{data.year ?? 'Рік не вказано'}</Typography.Text>
        </Space>
      </div>

      <Card>
        <Typography.Paragraph style={{ fontSize: 16 }}>
          {data.publicSummary ?? 'Публічний опис для цього авто ще не заповнено.'}
        </Typography.Paragraph>
      </Card>

      {visibleGalleries.length > 0 ? (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {visibleGalleries.map((gallery) => (
            <GallerySection key={gallery.id} gallery={gallery} />
          ))}
        </Space>
      ) : (
        <Empty description="Фото ще не додано" />
      )}

      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap size="large">
            <Statistic
              title="Зібрано"
              value={formatCurrency(data.publicCollectedAmountUahMinor ?? 0, 'UAH')}
            />
            {data.publicGoalAmountUahMinor ? (
              <Statistic
                title="Ціль"
                value={formatCurrency(data.publicGoalAmountUahMinor, 'UAH')}
              />
            ) : null}
          </Space>
          {progress !== null ? <Progress percent={progress} /> : null}
        </Space>
      </Card>

      <Descriptions bordered column={{ xs: 1, md: 2 }}>
        <Descriptions.Item label="Публічний номер">{data.identifier}</Descriptions.Item>
        <Descriptions.Item label="Статус">{data.status.name}</Descriptions.Item>
        <Descriptions.Item label="Дата створення">{formatDate(data.createdAt)}</Descriptions.Item>
        <Descriptions.Item label="Зібрано">
          {formatCurrency(data.publicCollectedAmountUahMinor ?? 0, 'UAH')}
        </Descriptions.Item>
      </Descriptions>
    </Space>
  );
}
