import { useState } from 'react';
import {
  CarOutlined,
  DollarOutlined,
  FileTextOutlined,
  PlusOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Progress,
  Row,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  notification,
} from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import type { ExpenseResponse } from '@volunteerfleet/shared';
import { useDashboardStats } from '../../hooks/useDashboard';
import { useExpensesList } from '../../hooks/useExpenses';
import { VehicleFormModal } from '../../modals/VehicleFormModal';
import { ExpenseFormModal } from '../../modals/ExpenseFormModal';
import { DocumentFormModal } from '../../modals/DocumentFormModal';
import { useAuth, useOrgRole } from '../../stores/auth.store';

function formatUah(value: number | undefined): string {
  if (value === undefined) return '—';
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(value);
}

function currentMonthLabel(): string {
  return new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' }).format(new Date());
}

const RECENT_EXPENSES_PARAMS = { page: 1, pageSize: 5, sort: '-expenseDate' };

const expenseColumns: ColumnsType<ExpenseResponse> = [
  {
    title: 'Дата',
    dataIndex: 'expenseDate',
    width: 110,
    render: (v: string) => new Date(v).toLocaleDateString('uk-UA'),
  },
  {
    title: 'Авто',
    dataIndex: ['vehicle', 'identifier'],
    render: (_: string, row: ExpenseResponse) =>
      row.vehicle ? (
        <Link to={`/vehicles/${row.vehicle.id}`}>
          {row.vehicle.identifier}
          {row.vehicle.brand ? ` · ${row.vehicle.brand}` : ''}
        </Link>
      ) : (
        '—'
      ),
  },
  {
    title: 'Категорія',
    dataIndex: ['category', 'name'],
    render: (v: string) => <Tag>{v}</Tag>,
  },
  {
    title: 'Сума',
    dataIndex: 'amount',
    align: 'right',
    render: (v: string, row: ExpenseResponse) => `${v} ${row.currency}`,
  },
  {
    title: 'Джерело',
    dataIndex: ['fundingSource', 'name'],
    render: (v: string) => v ?? '—',
  },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const [notifApi, notifContext] = notification.useNotification();
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const orgRole = useOrgRole();
  const user = useAuth((s) => s.user);
  const canMutate = orgRole !== null && orgRole !== 'viewer';

  const {
    totalVehicles,
    inWorkVehicles,
    transferredVehicles,
    monthlyExpenseUah,
    documentsTotal,
    documentsThisMonth,
    statusCounts,
    isLoading,
  } = useDashboardStats();

  const { data: recentExpenses, isLoading: expensesLoading } =
    useExpensesList(RECENT_EXPENSES_PARAMS);

  const nonFinalStatuses = (statusCounts ?? []).filter((s) => s.kind !== 'final');
  const finalStatuses = (statusCounts ?? []).filter((s) => s.kind === 'final');

  if (user && user.userRole !== 'superuser' && !user.activeOrgId) {
    return (
      <Empty
        description={
          <Typography.Text>
            Вас ще не додано до жодної організації. Зверніться до координатора.
          </Typography.Text>
        }
      />
    );
  }

  if (user && user.userRole === 'superuser' && !user.activeOrgId) {
    return (
      <Empty
        description={
          <Typography.Text>
            Активна організація не вибрана. Оберіть організацію у верхньому меню.
          </Typography.Text>
        }
      />
    );
  }

  return (
    <div>
      {notifContext}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <Typography.Title level={2} style={{ marginTop: 0, marginBottom: 4 }}>
            Дашборд
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Огляд активності ініціативи та ключові показники флоту.
          </Typography.Paragraph>
        </div>
        {canMutate && (
          <Space wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setVehicleOpen(true)}>
              Додати авто
            </Button>
            <Button icon={<DollarOutlined />} onClick={() => setExpenseOpen(true)}>
              Додати витрату
            </Button>
            <Button icon={<FileTextOutlined />} onClick={() => setDocOpen(true)}>
              Додати документ
            </Button>
          </Space>
        )}
      </div>
      <div style={{ marginBottom: 24 }} />

      {/* KPI row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title="Авто у роботі"
                value={inWorkVehicles ?? '—'}
                prefix={<CarOutlined style={{ color: '#1677ff' }} />}
                suffix={typeof inWorkVehicles === 'number' ? 'шт.' : undefined}
                valueStyle={{ color: '#1677ff' }}
              />
            )}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              у роботі зараз
            </Typography.Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title="Передано всього"
                value={transferredVehicles ?? '—'}
                prefix={<RiseOutlined style={{ color: '#52c41a' }} />}
                suffix={typeof transferredVehicles === 'number' ? 'шт.' : undefined}
                valueStyle={{ color: '#52c41a' }}
              />
            )}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              за весь час
            </Typography.Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title="Витрати за місяць"
                value={monthlyExpenseUah !== undefined ? formatUah(monthlyExpenseUah) : '—'}
                prefix={<DollarOutlined style={{ color: '#722ed1' }} />}
              />
            )}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {currentMonthLabel()}
            </Typography.Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title="Документи додано"
                value={documentsTotal ?? '—'}
                prefix={<FileTextOutlined style={{ color: '#13c2c2' }} />}
                suffix={typeof documentsTotal === 'number' ? 'шт.' : undefined}
              />
            )}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {typeof documentsThisMonth === 'number'
                ? `+${documentsThisMonth} за місяць`
                : 'за весь час'}
            </Typography.Text>
          </Card>
        </Col>
      </Row>

      {/* Widget row */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {/* Recent expenses */}
        <Col xs={24} lg={16}>
          <Card title="Останні витрати" extra={<Link to="/expenses">Переглянути всі ↗</Link>}>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              Останні 5 транзакцій за транспортними засобами
            </Typography.Text>
            {expensesLoading ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : (recentExpenses?.items?.length ?? 0) === 0 ? (
              <Empty description="Поки що немає витрат" />
            ) : (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={recentExpenses?.items ?? []}
                columns={expenseColumns}
                scroll={{ x: 600 }}
              />
            )}
          </Card>
        </Col>

        {/* Vehicle status breakdown */}
        <Col xs={24} lg={8}>
          <Card title="Авто за статусами">
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              Розподіл парку за поточним станом готовності
            </Typography.Text>
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Typography.Text strong style={{ fontSize: 16 }}>
                    Загальний флот:{' '}
                  </Typography.Text>
                  <Typography.Text style={{ fontSize: 16 }}>{totalVehicles ?? 0}</Typography.Text>
                </div>

                {(totalVehicles ?? 0) > 0 && (
                  <>
                    {nonFinalStatuses.map((s) => (
                      <div key={s.status} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography.Text>{s.statusName}</Typography.Text>
                          <Typography.Text strong>{s.count}</Typography.Text>
                        </div>
                        <Progress
                          percent={totalVehicles ? Math.round((s.count / totalVehicles) * 100) : 0}
                          showInfo={false}
                          strokeColor={s.color}
                          size="small"
                        />
                      </div>
                    ))}

                    {finalStatuses.length > 0 && (
                      <>
                        <Divider style={{ margin: '8px 0' }} />
                        {finalStatuses.map((s) => (
                          <div key={s.status} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography.Text>{s.statusName}</Typography.Text>
                              <Typography.Text strong>{s.count}</Typography.Text>
                            </div>
                            <Progress
                              percent={
                                totalVehicles ? Math.round((s.count / totalVehicles) * 100) : 0
                              }
                              showInfo={false}
                              strokeColor={s.color}
                              size="small"
                            />
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </Card>
        </Col>
      </Row>

      {canMutate && (
        <>
          <VehicleFormModal
            open={vehicleOpen}
            onClose={() => setVehicleOpen(false)}
            onCreated={(vehicle) => {
              notifApi.success({
                message: 'Авто додано',
                description: (
                  <Button
                    type="link"
                    style={{ padding: 0 }}
                    onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                  >
                    {vehicle.identifier} — відкрити деталі
                  </Button>
                ),
                duration: 6,
              });
            }}
          />
          <ExpenseFormModal open={expenseOpen} onClose={() => setExpenseOpen(false)} />
          <DocumentFormModal open={docOpen} onClose={() => setDocOpen(false)} />
        </>
      )}
    </div>
  );
}
