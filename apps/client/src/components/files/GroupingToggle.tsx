import { Checkbox, Input, Space, Tooltip } from 'antd';

export type GroupingMode = 'locked' | 'optional' | 'hidden';

interface GroupingToggleProps {
  mode: GroupingMode;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  // When provided, a group-name input is shown while grouping is on.
  name?: string;
  onNameChange?: (name: string) => void;
  namePlaceholder?: string;
}

// Controls whether a batch of attachments is grouped into one logical document.
// 'locked' shows a disabled (checked) checkbox for obviousness; 'optional' lets
// the user toggle it; 'hidden' renders nothing. When grouping is on and an
// onNameChange handler is given, an optional group-name field is shown.
export function GroupingToggle({
  mode,
  checked,
  onChange,
  name,
  onNameChange,
  namePlaceholder,
}: GroupingToggleProps) {
  if (mode === 'hidden') return null;

  const checkbox = (
    <Checkbox
      checked={checked}
      disabled={mode === 'locked'}
      onChange={(e) => onChange?.(e.target.checked)}
    >
      Згрупувати файли в один документ
    </Checkbox>
  );

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      {mode === 'locked' ? (
        <Tooltip title="Для цих документів файли завжди групуються в один документ">
          {checkbox}
        </Tooltip>
      ) : (
        checkbox
      )}
      {checked && onNameChange && (
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={namePlaceholder ?? 'Назва документа (необовʼязково)'}
          maxLength={255}
        />
      )}
    </Space>
  );
}
