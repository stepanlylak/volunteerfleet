import { EditOutlined } from '@ant-design/icons';
import { Button, Form, InputNumber, Select, Space, Tooltip, Typography } from 'antd';
import { useCallback, useEffect, useRef } from 'react';
import type { FormInstance } from 'antd';
import type { Currency } from '@volunteerfleet/shared';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { formatCurrency } from '../utils/format';

const CURRENCIES: Currency[] = ['UAH', 'USD', 'EUR'];

interface MoneyFieldsProps {
  form: FormInstance;
  amountFieldName?: string;
  currencyFieldName?: string;
  rateFieldName?: string;
  currency: Currency;
  rate: number;
  amount: number;
  rateSource: 'default' | 'manual';
  date: string | undefined;
  onCurrencyChange: (currency: Currency) => void;
  onRateChange: (rate: number) => void;
  onRateSourceChange: (source: 'default' | 'manual') => void;
  onAmountChange?: (amount: number) => void;
  isEdit?: boolean;
  disabled?: boolean;
}

export function MoneyFields({
  form,
  amountFieldName = 'amount',
  currencyFieldName = 'currency',
  rateFieldName = 'rate',
  currency,
  rate,
  amount,
  rateSource,
  date,
  onCurrencyChange,
  onRateChange,
  onRateSourceChange,
  onAmountChange,
  isEdit = false,
  disabled = false,
}: MoneyFieldsProps) {
  const isRateManuallyChangedRef = useRef(false);
  const isUAH = currency === 'UAH';
  const amountUahMinor = Math.round(amount * 100 * rate);

  const shouldFetchRate = !isUAH && !!date && !isEdit;
  const { data: rateData, isFetching: rateFetching } = useExchangeRate(
    shouldFetchRate ? date : undefined,
    shouldFetchRate ? currency : undefined,
  );

  useEffect(() => {
    if (rateData && !isRateManuallyChangedRef.current) {
      onRateChange(rateData.rate);
      onRateSourceChange('default');
      form.setFieldValue(rateFieldName, rateData.rate);
    }
  }, [rateData, form, rateFieldName, onRateChange, onRateSourceChange]);

  useEffect(() => {
    if (isUAH) {
      isRateManuallyChangedRef.current = false;
      onRateChange(1);
      onRateSourceChange('default');
      form.setFieldValue(rateFieldName, 1);
    }
  }, [isUAH, form, rateFieldName, onRateChange, onRateSourceChange]);

  const handleReset = useCallback(async () => {
    if (!date || isUAH) return;
    isRateManuallyChangedRef.current = false;
    const { exchangeRatesApi } = await import('../api/exchange-rates.api');
    const data = await exchangeRatesApi.getRate(date, currency).catch(() => null);
    if (data) {
      onRateChange(data.rate);
      onRateSourceChange('default');
      form.setFieldValue(rateFieldName, data.rate);
    }
  }, [date, isUAH, currency, form, rateFieldName, onRateChange, onRateSourceChange]);

  return (
    <>
      <Space.Compact style={{ width: '100%' }}>
        <Form.Item
          name={amountFieldName}
          label="Сума"
          style={{ flex: 1 }}
          rules={[{ required: true, message: 'Введіть суму' }]}
        >
          <InputNumber
            min={0.01}
            precision={2}
            style={{ width: '100%' }}
            disabled={disabled}
            onChange={(v) => onAmountChange?.(v ?? 0)}
          />
        </Form.Item>
        <Form.Item
          name={currencyFieldName}
          label="Валюта"
          style={{ width: 100 }}
          rules={[{ required: true }]}
        >
          <Select
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            onChange={(v: Currency) => {
              onCurrencyChange(v);
              isRateManuallyChangedRef.current = false;
            }}
            disabled={disabled}
          />
        </Form.Item>
      </Space.Compact>

      {!isUAH && (
        <Typography.Text
          type="secondary"
          style={{ display: 'block', marginTop: -12, marginBottom: 12 }}
        >
          ≈ {formatCurrency(amountUahMinor, 'UAH')}
        </Typography.Text>
      )}

      {!isUAH && (
        <Form.Item
          name={rateFieldName}
          label={
            <Space>
              <span>Курс до UAH</span>
              {rateSource === 'manual' && (
                <Tooltip title="Курс встановлено вручну">
                  <EditOutlined style={{ color: '#faad14' }} />
                </Tooltip>
              )}
            </Space>
          }
          rules={[{ required: true, message: 'Введіть курс' }]}
        >
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber
              style={{ flex: 1 }}
              min={0.0001}
              precision={4}
              disabled={isUAH || rateFetching || disabled}
              value={rate}
              onChange={(v) => {
                if (v !== null) {
                  onRateChange(v);
                  isRateManuallyChangedRef.current = true;
                  onRateSourceChange('manual');
                  form.setFieldValue(rateFieldName, v);
                }
              }}
            />
            <Button onClick={() => void handleReset()} disabled={rateFetching || disabled}>
              Скинути
            </Button>
          </Space.Compact>
        </Form.Item>
      )}
    </>
  );
}
