import { Layout, Typography } from 'antd';
import { Link, Outlet } from 'react-router-dom';
import '../../styles/global.css';

const { Header, Content } = Layout;

export function PublicLayout() {
  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <Header
        style={{
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          padding: '0 24px',
        }}
      >
        <Link to="/public">
          <Typography.Title level={4} style={{ margin: 0, lineHeight: '64px' }}>
            VolunteerFleet
          </Typography.Title>
        </Link>
      </Header>
      <Content style={{ width: '100%', maxWidth: 1040, margin: '0 auto', padding: 24 }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
