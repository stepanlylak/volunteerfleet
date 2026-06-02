import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

export function ForbiddenPage() {
  const navigate = useNavigate();
  return (
    <Result
      status="403"
      title="403"
      subTitle="У вас немає доступу до цієї сторінки"
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          На дашборд
        </Button>
      }
    />
  );
}
