import { Button, DatePicker, Form, Input, Modal, Select, Space, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import type { Currency, DonationResponse } from '@volunteerfleet/shared';
import { donationCreateSchema } from '@volunteerfleet/shared';
import { MoneyFields } from '../components/MoneyFields';
import { DonorPicker } from '../components/DonorPicker';
import { useCreateDonation, useUpdateDonation } from '../hooks/useDonations';
import { useDictionary } from '../hooks/useDictionaries';
import { useVehicles } from '../hooks/useVehicles';
import type { FinancialCategory } from '@volunteerfleet/shared';

interface DonationFormModalProps {
  open: boolean;
  vehicleId?: string;
  donation?: DonationResponse;
  onClose: () => void;
  onCreated?: (donation: DonationResponse) => void;
}

interface FormValues {
  donationDate: dayjs.Dayjs;
  amount: number;
  currency: Currency;
  rate: number;
  categoryId?: string;
  donorId: string;
  vehicleId: string;
  description?: string;
}

export function DonationFormModal({
  open,
  vehicleId,
  donation,
  onClose,
  onCreated,
}: DonationFormModalProps) {
  const [form] = Form.useForm<FormValues>();
  const isEdit = !!donation;
  const hasPreselectedVehicle = !!vehicleId;

  const { data: vehiclesData } = useVehicles({ pageSize: 100 });
  const { data: categoriesData } = useDictionary('financial-categories');
  const categories = (categoriesData ?? []) as FinancialCategory[];

  const [currency, setCurrency] = useState<Currency>('UAH');
  const [donationDate, setDonationDate] = useState<string | undefined>();
  const [rateSource, setRateSource] = useState<'default' | 'manual'>('default');
  const [amount, setAmount] = useState<number>(0);
  const [rate, setRate] = useState<number>(1);

  const createDonation = useCreateDonation();
  const updateDonation = useUpdateDonation();

  useEffect(() => {
    if (!open) return;
    if (donation) {
      setCurrency(donation.currency);
      setDonationDate(donation.donationDate);
      setRateSource(donation.rateSource);
      setAmount(donation.amountMinor / 100);
      setRate(donation.rate);
      form.setFieldsValue({
        donationDate: dayjs(donation.donationDate),
        amount: donation.amountMinor / 100,
        currency: donation.currency,
        rate: donation.rate,
        categoryId: donation.categoryId ?? undefined,
        donorId: donation.donorId,
        vehicleId: donation.vehicleId,
        description: donation.description ?? undefined,
      });
    } else {
      form.resetFields();
      setCurrency('UAH');
      setDonationDate(dayjs().format('YYYY-MM-DD'));
      setRateSource('default');
      setAmount(0);
      setRate(1);
      form.setFieldsValue({
        donationDate: dayjs(),
        currency: 'UAH',
        rate: 1,
        vehicleId: vehicleId,
      });
    }
  }, [open, donation, form, vehicleId]);

  const onFinish = async (values: FormValues) => {
    const normalizedDate = values.donationDate.format('YYYY-MM-DD');
    const effectiveRate = values.currency === 'UAH' ? 1 : Number(values.rate);
    const payload = {
      vehicleId: values.vehicleId,
      donationDate: normalizedDate,
      amountMinor: Math.round(Number(values.amount) * 100),
      currency: values.currency,
      rate: effectiveRate,
      categoryId: values.categoryId ?? null,
      description: values.description || null,
      donorId: values.donorId,
    };

    const parsed = donationCreateSchema.safeParse(payload);
    if (!parsed.success) {
      message.error(parsed.error.issues[0]?.message ?? 'Помилка валідації');
      return;
    }

    try {
      if (isEdit) {
        await updateDonation.mutateAsync({ id: donation.id, payload: parsed.data });
        message.success('Надходження оновлено');
        onClose();
      } else {
        const created = await createDonation.mutateAsync(parsed.data);
        message.success('Надходження додано');
        onCreated?.(created);
        onClose();
      }
    } catch {
      message.error('Помилка при збереженні надходження');
    }
  };

  const isPending = createDonation.isPending || updateDonation.isPending;

  return (
    <Modal
      open={open}
      title={isEdit ? 'Редагувати надходження' : 'Додати надходження'}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={560}
    >
      <Form form={form} layout="vertical" onFinish={onFinish} validateTrigger="onBlur">
        <Form.Item
          name="vehicleId"
          label="Автомобіль"
          rules={[{ required: true, message: 'Оберіть автомобіль' }]}
        >
          <Select
            showSearch
            placeholder="Оберіть автомобіль"
            optionFilterProp="label"
            disabled={hasPreselectedVehicle}
            options={(vehiclesData?.items ?? []).map((v) => ({
              value: v.id,
              label: `${v.identifier} — ${v.brand} ${v.model}`,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="donationDate"
          label="Дата надходження"
          rules={[{ required: true, message: 'Оберіть дату' }]}
        >
          <DatePicker
            style={{ width: '100%' }}
            format="DD.MM.YYYY"
            onChange={(date) => {
              if (date) {
                setDonationDate(date.format('YYYY-MM-DD'));
              }
            }}
          />
        </Form.Item>

        <MoneyFields
          form={form}
          currency={currency}
          rate={rate}
          amount={amount}
          rateSource={rateSource}
          date={donationDate}
          isEdit={isEdit}
          onCurrencyChange={setCurrency}
          onRateChange={setRate}
          onRateSourceChange={setRateSource}
          onAmountChange={setAmount}
        />

        <Form.Item name="categoryId" label="Категорія">
          <Select
            allowClear
            placeholder="Оберіть категорію"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Form.Item>

        <Form.Item
          name="donorId"
          label="Донор"
          rules={[{ required: true, message: 'Оберіть донора' }]}
        >
          <DonorPicker />
        </Form.Item>

        <Form.Item name="description" label="Опис">
          <Input.TextArea rows={3} maxLength={2000} showCount />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={onClose}>Скасувати</Button>
            <Button type="primary" htmlType="submit" loading={isPending}>
              {isEdit ? 'Зберегти' : 'Додати'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
