import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginRequestSchema } from '@volunteerfleet/shared';
import { authApi } from '../../api/auth.api';
import { useAuth } from '../../stores/auth.store';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);
  const user = useAuth((s) => s.user);
  const [form] = Form.useForm();

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const onFinish = async (values: { email: string; password: string }) => {
    const parsed = loginRequestSchema.safeParse(values);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      message.error(firstError?.message ?? 'Невірні дані');
      return;
    }
    try {
      const data = await authApi.login(parsed.data);
      setAuth(data);
      navigate('/dashboard', { replace: true });
    } catch {
      message.error('Невірний email або пароль');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #e6f0ff 0%, #f0f2f5 100%)',
      }}
    >
      <Card
        style={{
          width: 420,
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          borderRadius: 12,
        }}
        styles={{ body: { padding: '40px 40px 32px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="/volunteer-fleet-login-logo.png"
            alt="VolunteerFleet"
            style={{ height: 111 }}
          />
          <br />
          <Typography.Text type="secondary">Платформа обліку транспорту ЗСУ</Typography.Text>
        </div>

        <Form
          form={form}
          name="login"
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
          requiredMark={false}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Введіть email' },
              { type: 'email', message: 'Невірний формат email' },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="admin@example.com"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="Пароль"
            name="password"
            rules={[{ required: true, message: 'Введіть пароль' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="••••••••"
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Button type="primary" htmlType="submit" block size="large">
              Увійти
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
