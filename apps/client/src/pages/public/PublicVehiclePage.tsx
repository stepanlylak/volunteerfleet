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
import { publicApi } from '../../api/public.api';
import { formatCurrency, formatDate } from '../../utils/format';

export function PublicVehiclePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public', 'vehicle', slug],
    queryFn: () => publicApi.getVehicle(slug!),
    enabled: Boolean(slug),
    retry: false,
  });

  if (isLoading) return <Skeleton active />;
  if (isError || !data) {
    return <Result status="404" title="Сторінка не знайдена або недоступна" />;
  }

  const hasGoal = Boolean(data.publicGoalAmountUah);
  const progress = hasGoal
    ? Math.min(
        100,
        Math.round(((data.publicCollectedAmountUah ?? 0) / data.publicGoalAmountUah!) * 100),
      )
    : null;

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

      {data.photos.length > 0 ? (
        <Image.PreviewGroup>
          <Space wrap size="middle">
            {data.photos.map((photo) => (
              <Image
                key={photo.id}
                width={220}
                height={150}
                style={{ objectFit: 'cover' }}
                src={publicApi.getVehiclePhotoUrl(photo.id)}
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
              value={data.publicCollectedAmountUah ?? 0}
              precision={2}
              suffix="₴"
            />
            {data.publicGoalAmountUah ? (
              <Statistic title="Ціль" value={data.publicGoalAmountUah} precision={2} suffix="₴" />
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
          {formatCurrency(data.publicCollectedAmountUah ?? 0, 'UAH')}
        </Descriptions.Item>
      </Descriptions>
    </Space>
  );
}
