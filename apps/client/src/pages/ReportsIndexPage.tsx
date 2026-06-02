import { FileTextOutlined } from '@ant-design/icons';
import { Button, Empty, List, Skeleton, Space, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import type { FundingSource } from '@volunteerfleet/shared';
import { useDictionary } from '../hooks/useDictionaries';

export function ReportsIndexPage() {
  const { data, isLoading } = useDictionary('funding-sources');
  const fundingSources = (data ?? []) as FundingSource[];

  if (isLoading) return <Skeleton active />;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2}>Звіти</Typography.Title>
        <Typography.Text type="secondary">
          Друковані звіти для авто та джерел фінансування
        </Typography.Text>
      </div>

      <List<FundingSource>
        dataSource={fundingSources}
        locale={{ emptyText: <Empty description="Джерел фінансування ще немає" /> }}
        renderItem={(source) => (
          <List.Item
            actions={[
              <Link key="open" to={`/reports/funding/${source.id}`}>
                <Button icon={<FileTextOutlined />}>Звіт</Button>
              </Link>,
            ]}
          >
            <List.Item.Meta
              title={source.name}
              description={
                <Space wrap>
                  <Tag>{source.type}</Tag>
                  <span>{source.description ?? 'Без опису'}</span>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Space>
  );
}
