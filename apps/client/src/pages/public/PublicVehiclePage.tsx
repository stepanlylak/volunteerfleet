import {
  Card,
  Descriptions,
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
import { publicApi } from '../../api/public.api';
import { formatCurrency, formatDate } from '../../utils/format';

function flattenGalleryItems(galleries: PublicVehicleGallery[]) {
  const items: { id: string; galleryLabel: string; caption: string | null }[] = [];
  for (const gallery of galleries) {
    for (const item of gallery.items) {
      items.push({
        id: item.id,
        galleryLabel: gallery.displayLabel,
        caption: item.caption,
      });
    }
  }
  return items;
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

  const allGalleryItems = flattenGalleryItems(data.galleries);

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

      {allGalleryItems.length > 0 ? (
        <Image.PreviewGroup>
          <Space wrap size="middle">
            {allGalleryItems.map((item) => (
              <Image
                key={item.id}
                width={220}
                height={150}
                style={{ objectFit: 'cover' }}
                src={publicApi.getGalleryItemDownloadUrl(item.id)}
                alt={item.caption ?? item.galleryLabel}
              />
            ))}
          </Space>
        </Image.PreviewGroup>
      ) : null}

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
