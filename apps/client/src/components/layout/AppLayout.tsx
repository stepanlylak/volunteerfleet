import {
  BankOutlined,
  CarOutlined,
  DashboardOutlined,
  DownOutlined,
  HeartOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  ShopOutlined,
  TagsOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Layout, Menu, Tooltip, message } from 'antd';
import type { MenuProps } from 'antd';
import { useState } from 'react';
import { useLocation, useNavigate, Link, Outlet } from 'react-router-dom';
import { useAuth, useMemberships } from '@/stores/auth.store.ts';
import { authApi } from '@/api/auth.api.ts';
import { useQueryClient } from '@tanstack/react-query';

const { Header, Sider, Content } = Layout;

const ORG_ROLE_LABELS: Record<string, string> = {
  coordinator: 'Координатор',
  volunteer: 'Волонтер',
  viewer: 'Спостерігач',
};

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Дашборд',
  '/vehicles': 'Автомобілі',
  '/donors': 'Донори',
  '/finances': 'Фінанси',
  '/admin/users': 'Користувачі',
  '/admin/organizations': 'Організації',
  '/admin/dictionaries': 'Довідники',
  '/my-organization': 'Налаштування організації',
};

function getInitials(name?: string): string {
  if (!name) return '·';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '');
  return letters.toUpperCase() || name[0]!.toUpperCase();
}

function PulseMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 13h3.2l2-6 3 12 2.6-9 1.8 3H22"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AppLayout() {
  const user = useAuth((s) => s.user);
  const memberships = useMemberships();
  const setAuth = useAuth((s) => s.setAuth);
  const clearAuth = useAuth((s) => s.clear);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);

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
    '/donors',
    '/finances',
    '/admin/users',
    '/admin/organizations',
    '/admin/dictionaries',
    '/my-organization',
  ];
  const selectedKey =
    menuKeys
      .filter((key) => location.pathname === key || location.pathname.startsWith(`${key}/`))
      .sort((a, b) => b.length - a.length)[0] ?? location.pathname;

  const menuItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/dashboard">Дашборд</Link>,
    },
    {
      type: 'group',
      label: 'Реєстр',
      children: [
        {
          key: '/vehicles',
          icon: <CarOutlined />,
          label: <Link to="/vehicles">Автомобілі</Link>,
        },
        {
          key: '/donors',
          icon: <HeartOutlined />,
          label: <Link to="/donors">Донори</Link>,
        },
        {
          key: '/finances',
          icon: <WalletOutlined />,
          label: <Link to="/finances">Фінанси</Link>,
        },
      ],
    },
    ...(user?.userRole === 'superuser'
      ? [
          {
            type: 'group' as const,
            label: 'Адміністрування',
            children: [
              {
                key: '/admin/users',
                icon: <TeamOutlined />,
                label: <Link to="/admin/users">Користувачі</Link>,
              },
              {
                key: '/admin/organizations',
                icon: <BankOutlined />,
                label: <Link to="/admin/organizations">Організації</Link>,
              },
              {
                key: '/admin/dictionaries',
                icon: <TagsOutlined />,
                label: <Link to="/admin/dictionaries">Довідники</Link>,
              },
            ],
          },
        ]
      : []),
    ...(user?.orgRole === 'coordinator'
      ? [
          {
            type: 'group' as const,
            label: 'Організація',
            children: [
              {
                key: '/my-organization',
                icon: <SettingOutlined />,
                label: <Link to="/my-organization">Налаштування</Link>,
              },
            ],
          },
        ]
      : []),
  ];

  const activeOrg = memberships.find((m) => m.organizationId === user?.activeOrgId);
  const roleLabel =
    user?.userRole === 'superuser'
      ? 'Адміністратор системи'
      : (user?.orgRole && ORG_ROLE_LABELS[user.orgRole]) || 'Користувач';
  const pageTitle = PAGE_TITLES[selectedKey] ?? 'VolunteerFleet';

  return (
    <Layout className="app-shell">
      <Sider
        className="app-sider"
        width={252}
        collapsedWidth={80}
        breakpoint="xl"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        theme="dark"
      >
        <Link to="/dashboard" className="app-brand">
          <span className="app-brand-tile">
            <PulseMark />
          </span>
          {!collapsed && (
            <span className="app-brand-text">
              <span className="app-brand-name">VolunteerFleet</span>
              <span className="app-brand-sub">облік транспорту ЗСУ</span>
            </span>
          )}
        </Link>

        <div className="app-nav">
          <Menu mode="inline" theme="dark" selectedKeys={[selectedKey]} items={menuItems} />
        </div>

        <div className="app-usercard">
          <span className="app-usercard-avatar">{getInitials(user?.fullName)}</span>
          {!collapsed && (
            <>
              <span className="app-usercard-meta">
                <span className="app-usercard-name">{user?.fullName}</span>
                <span className="app-usercard-role">{roleLabel}</span>
              </span>
              <Tooltip title="Вийти" placement="top">
                <Button
                  className="app-usercard-logout"
                  type="text"
                  size="small"
                  icon={<LogoutOutlined />}
                  onClick={handleLogout}
                />
              </Tooltip>
            </>
          )}
        </div>
      </Sider>

      <Layout>
        <Header className="app-header">
          <div className="app-header-left">
            <Button
              className="app-collapse-btn"
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((c) => !c)}
            />
            <span className="app-header-title">{pageTitle}</span>
          </div>

          {memberships.length > 0 && (
            <Dropdown
              trigger={['click']}
              menu={{
                selectable: true,
                selectedKeys: user?.activeOrgId ? [user.activeOrgId] : [],
                items: memberships.map((m) => ({
                  key: m.organizationId,
                  label: m.name,
                  disabled: m.organizationId === user?.activeOrgId,
                  onClick: () => handleSwitchOrg(m.organizationId),
                })),
              }}
            >
              <Button className="app-org-btn" icon={<ShopOutlined />}>
                {activeOrg?.name ?? 'Організація'}
                <DownOutlined style={{ fontSize: 11, opacity: 0.6 }} />
              </Button>
            </Dropdown>
          )}
        </Header>

        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
