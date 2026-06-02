import { CarOutlined, DollarOutlined, LogoutOutlined, TeamOutlined, ToolOutlined } from '@ant-design/icons';
import { Button, Dropdown, Layout, Menu, Space, Typography } from 'antd';
import { useLocation, useNavigate, Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../stores/auth.store';
import { authApi } from '../../api/auth.api';

const { Header, Sider, Content } = Layout;

export function AppLayout() {
  const user = useAuth((s) => s.user);
  const clearAuth = useAuth((s) => s.clear);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  const menuKeys = ['/dashboard', '/vehicles', '/expenses', '/reports', '/admin/users', '/admin/dictionaries'];
  const selectedKey =
    menuKeys
      .filter((key) => location.pathname === key || location.pathname.startsWith(`${key}/`))
      .sort((a, b) => b.length - a.length)[0] ?? location.pathname;

  const menuItems = [
    {
      key: '/dashboard',
      icon: <ToolOutlined />,
      label: <Link to="/dashboard">Дашборд</Link>,
    },
    {
      key: '/vehicles',
      icon: <CarOutlined />,
      label: <Link to="/vehicles">Автомобілі</Link>,
    },
    {
      key: '/expenses',
      icon: <DollarOutlined />,
      label: <Link to="/expenses">Витрати</Link>,
    },
    {
      key: '/reports',
      icon: <ToolOutlined />,
      label: <Link to="/reports">Звіти</Link>,
    },
    ...(user?.role === 'admin'
      ? [
          {
            key: '/admin',
            icon: <TeamOutlined />,
            label: 'Адмін',
            children: [
              {
                key: '/admin/users',
                label: <Link to="/admin/users">Користувачі</Link>,
              },
              {
                key: '/admin/dictionaries',
                label: <Link to="/admin/dictionaries">Довідники</Link>,
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="80" theme="light">
        <a href="/" style={{ padding: '8px', textAlign: 'center', display: 'block' }}>
          <img
            src="/volunteer-fleet-logo.png"
            alt="VolunteerFleet"
            style={{ height: 48, maxWidth: '100%' }}
          />
        </a>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={['/admin']}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <Space>
              <Typography.Text>{user?.fullName}</Typography.Text>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'logout',
                      icon: <LogoutOutlined />,
                      label: 'Вийти',
                      onClick: handleLogout,
                    },
                  ],
                }}
                placement="bottomRight"
              >
                <Button shape="circle" icon={<TeamOutlined />} />
              </Dropdown>
            </Space>
          </div>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
