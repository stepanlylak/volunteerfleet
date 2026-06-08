import {
  CarOutlined,
  DollarOutlined,
  DownOutlined,
  LogoutOutlined,
  SettingOutlined,
  ShopOutlined,
  TeamOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Layout, Menu, Space, Typography, message } from 'antd';
import { useLocation, useNavigate, Link, Outlet } from 'react-router-dom';
import { useAuth, useMemberships } from '@/stores/auth.store.ts';
import { authApi } from '@/api/auth.api.ts';
import { CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const { Header, Sider, Content } = Layout;

const siderStyle: CSSProperties = {
  overflowY: 'auto',
  height: 'calc(100vh - 64px)',
  position: 'sticky',
  insetInlineStart: 0,
  top: 64,
  scrollbarWidth: 'thin',
  scrollbarGutter: 'auto',
};

export function AppLayout() {
  const user = useAuth((s) => s.user);
  const memberships = useMemberships();
  const setAuth = useAuth((s) => s.setAuth);
  const clearAuth = useAuth((s) => s.clear);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  const handleSwitchOrg = async (organizationId: string) => {
    try {
      await authApi.switchOrg({ organizationId });
      const updatedUser = await authApi.me();
      setAuth({ user: updatedUser });
      await queryClient.invalidateQueries();
      message.success('Організацію змінено');
    } catch {
      message.error('Не вдалося змінити організацію');
    }
  };

  const menuKeys = [
    '/dashboard',
    '/vehicles',
    '/expenses',
    '/reports',
    '/admin/users',
    '/admin/dictionaries',
  ];
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
    ...(user?.userRole === 'superuser'
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
                key: '/admin/organizations',
                label: <Link to="/admin/organizations">Організації</Link>,
              },
              {
                key: '/admin/dictionaries',
                label: <Link to="/admin/dictionaries">Довідники</Link>,
              },
            ],
          },
        ]
      : []),
    ...(user?.orgRole === 'coordinator'
      ? [
          {
            key: '/my-organization',
            icon: <SettingOutlined />,
            label: <Link to="/my-organization">Налаштування організації</Link>,
          },
        ]
      : []),
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: '#fff',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <a href="/" style={{ padding: '8px', textAlign: 'center', display: 'block' }}>
          <img
            src="/volunteer-fleet-logo.png"
            alt="VolunteerFleet"
            style={{ height: 48, maxWidth: '100%', display: 'block' }}
          />
        </a>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            height: '100%',
          }}
        >
          <Space size="large">
            {memberships.length > 0 && (
              <Dropdown
                menu={{
                  items: memberships.map((m) => ({
                    key: m.organizationId,
                    label: m.organizationId, // TODO: Назва організації буде в наступних тікетах або вже є в моделі?
                    disabled: m.organizationId === user?.activeOrgId,
                    onClick: () => handleSwitchOrg(m.organizationId),
                  })),
                }}
              >
                <Button type="text">
                  <Space>
                    <ShopOutlined />
                    Організація
                    <DownOutlined />
                  </Space>
                </Button>
              </Dropdown>
            )}
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
          </Space>
        </div>
      </Header>
      <Layout>
        <Sider breakpoint="xl" collapsedWidth="80" theme="light" style={siderStyle}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            defaultOpenKeys={['/admin']}
            items={menuItems}
          />
        </Sider>
        <Layout>
          <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', minHeight: 280 }}>
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
