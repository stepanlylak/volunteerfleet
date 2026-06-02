import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title="404"
      subTitle="Сторінку не знайдено"
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          На дашборд
        </Button>
      }
    />
  );
}
