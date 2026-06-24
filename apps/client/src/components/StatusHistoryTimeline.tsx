import {
  CalendarOutlined,
  ClockCircleOutlined,
  EditOutlined,
  FlagOutlined,
  RollbackOutlined,
  ShopOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Alert, Button, Popconfirm, Tooltip } from 'antd';
import type { CSSProperties } from 'react';
import dayjs from 'dayjs';
import {
  VEHICLE_DOCUMENT_GROUP_LABELS,
  VEHICLE_STATUS_CONFIG,
  type VehicleAlert,
  type VehicleStatusHistory,
} from '@volunteerfleet/shared';
import { VehicleStatusTag, softColorStyle } from './VehicleStatusTag';
import { StatusHistoryGroupLinks } from './files/StatusHistoryGroupLinks';

// Ukrainian plural for "день / дні / днів".
function daysWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return 'днів';
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дні';
  return 'днів';
}

function formatDays(n: number): string {
  return `${n} ${daysWord(n)}`;
}

// Whole-day distance between two ISO date/datetime strings.
function dayDiff(from: string, to: string): number {
  return Math.max(0, dayjs(to).startOf('day').diff(dayjs(from).startOf('day'), 'day'));
}

function relativeFromNow(iso: string): string {
  const now = dayjs();
  const then = dayjs(iso);
  const minutes = now.diff(then, 'minute');
  if (minutes < 1) return 'щойно';
  if (minutes < 60) return `${minutes} хв тому`;
  const hours = now.diff(then, 'hour');
  if (hours < 24 && now.isSame(then, 'day')) return `${hours} год тому`;
  const days = now.startOf('day').diff(then.startOf('day'), 'day');
  if (days === 0) return 'сьогодні';
  if (days === 1) return 'вчора';
  return `${days} ${daysWord(days)} тому`;
}

const DOC_SLOTS: { key: keyof VehicleStatusHistory; label: string }[] = [
  { key: 'registrationGroupId', label: VEHICLE_DOCUMENT_GROUP_LABELS.registrationGroupId },
  {
    key: 'stampedRegistrationGroupId',
    label: VEHICLE_DOCUMENT_GROUP_LABELS.stampedRegistrationGroupId,
  },
  {
    key: 'customsDeclarationGroupId',
    label: VEHICLE_DOCUMENT_GROUP_LABELS.customsDeclarationGroupId,
  },
  {
    key: 'stampedCustomsDeclarationGroupId',
    label: VEHICLE_DOCUMENT_GROUP_LABELS.stampedCustomsDeclarationGroupId,
  },
  { key: 'transferActDraftGroupId', label: VEHICLE_DOCUMENT_GROUP_LABELS.transferActDraftGroupId },
  {
    key: 'transferActSignedGroupId',
    label: VEHICLE_DOCUMENT_GROUP_LABELS.transferActSignedGroupId,
  },
  { key: 'returnActGroupId', label: VEHICLE_DOCUMENT_GROUP_LABELS.returnActGroupId },
];

interface StatusHistoryTimelineProps {
  items: VehicleStatusHistory[];
  alerts: VehicleAlert[];
  canMutate: boolean;
  canRollback: boolean;
  rollbackPending: boolean;
  onEdit: (entry: VehicleStatusHistory) => void;
  onRollback: (entry: VehicleStatusHistory) => void;
}

export function StatusHistoryTimeline({
  items,
  alerts,
  canMutate,
  canRollback,
  rollbackPending,
  onEdit,
  onRollback,
}: StatusHistoryTimelineProps) {
  if (items.length === 0) return null;

  const current = items[0]!;
  const currentCfg = VEHICLE_STATUS_CONFIG[current.newStatus];
  const oldest = items[items.length - 1]!;
  const daysInCurrent = dayDiff(current.transitionDate, dayjs().toISOString());
  const daysInRegistry = dayDiff(oldest.transitionDate, dayjs().toISOString());

  return (
    <div className="vf-sh">
      <div
        className="vf-sh__summary"
        style={{ '--status-color': currentCfg.color } as CSSProperties}
      >
        <div className="vf-sh__summary-main">
          <span className="vf-sh__summary-label">Поточний статус</span>
          <div className="vf-sh__summary-status">
            <VehicleStatusTag status={current.newStatus} style={{ margin: 0 }} />
            <span className="vf-sh__summary-since">
              {daysInCurrent === 0 ? 'сьогодні' : `${formatDays(daysInCurrent)} у статусі`}
            </span>
          </div>
        </div>
        <div className="vf-sh__summary-stats">
          <SummaryStat value={String(items.length)} label="переходів" />
          <SummaryStat value={formatDays(daysInRegistry)} label="у реєстрі" />
          <SummaryStat
            value={dayjs(current.changedAt).format('DD.MM.YYYY')}
            label="остання зміна"
          />
        </div>
      </div>

      <ol className="vf-sh__rail">
        {items.map((item, index) => {
          const cfg = VEHICLE_STATUS_CONFIG[item.newStatus];
          const nextColor =
            index < items.length - 1
              ? VEHICLE_STATUS_CONFIG[items[index + 1]!.newStatus].color
              : cfg.color;
          const isCurrent = index === 0;
          // How long the vehicle held this status: until the next (newer)
          // transition, or until now for the latest entry.
          const heldUntil = index === 0 ? dayjs().toISOString() : items[index - 1]!.transitionDate;
          const held = dayDiff(item.transitionDate, heldUntil);
          const itemAlerts = alerts.filter((a) => a.vehicleStatusHistoryId === item.id);
          const docSlots = DOC_SLOTS.filter((s) => item[s.key] != null);
          const showRollback = canMutate && canRollback && isCurrent && Boolean(item.oldStatus);

          return (
            <li
              key={item.id}
              className={`vf-sh__entry${isCurrent ? ' vf-sh__entry--current' : ''}`}
              style={
                {
                  '--status-color': cfg.color,
                  '--next-color': nextColor,
                } as CSSProperties
              }
            >
              <div className="vf-sh__marker" aria-hidden>
                <span className="vf-sh__dot" />
              </div>

              <div className="vf-sh__card">
                <div className="vf-sh__head">
                  <div className="vf-sh__flow">
                    <span className="vf-sh__flow-old" style={softColorStyle('#8c8c8c')}>
                      {item.oldStatus ? VEHICLE_STATUS_CONFIG[item.oldStatus].label : 'Старт'}
                    </span>
                    <span className="vf-sh__flow-arrow" aria-hidden>
                      →
                    </span>
                    <VehicleStatusTag status={item.newStatus} style={{ margin: 0 }} />
                    {item.newStatus === 'paid' && item.isLocalPurchase && (
                      <Tooltip title="Авто придбано локально — без розмитнення та перетину кордону">
                        <span className="vf-sh__chip">
                          <ShopOutlined />
                          Місцева покупка
                        </span>
                      </Tooltip>
                    )}
                  </div>
                  <div className="vf-sh__head-right">
                    <Tooltip
                      title={isCurrent ? 'Триває зараз' : `Тривалість статусу «${cfg.label}»`}
                    >
                      <span
                        className={`vf-sh__duration${isCurrent ? ' vf-sh__duration--live' : ''}`}
                        style={{ color: cfg.color }}
                      >
                        {isCurrent && <span className="vf-sh__live-dot" />}
                        {held === 0 ? 'того ж дня' : formatDays(held)}
                      </span>
                    </Tooltip>
                    {canMutate && (
                      <div className="vf-sh__actions">
                        <Tooltip title="Редагувати">
                          <Button
                            type="text"
                            size="small"
                            aria-label="Редагувати"
                            icon={<EditOutlined />}
                            onClick={() => onEdit(item)}
                          />
                        </Tooltip>
                        {showRollback && (
                          <Popconfirm
                            title="Відкотити останній статус?"
                            description="Авто повернеться до попереднього статусу, а цей запис історії буде видалено."
                            okText="Відкотити"
                            cancelText="Скасувати"
                            onConfirm={() => onRollback(item)}
                          >
                            <Tooltip title="Відкотити останній статус">
                              <Button
                                type="text"
                                size="small"
                                danger
                                aria-label="Відкотити останній статус"
                                icon={<RollbackOutlined />}
                                loading={rollbackPending}
                              />
                            </Tooltip>
                          </Popconfirm>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="vf-sh__meta">
                  <span className="vf-sh__meta-item vf-sh__meta-strong">
                    <CalendarOutlined />
                    {dayjs(item.transitionDate).format('DD.MM.YYYY')}
                  </span>
                  <Tooltip
                    title={`Запис створено ${dayjs(item.changedAt).format('DD.MM.YYYY HH:mm')}`}
                  >
                    <span className="vf-sh__meta-item">
                      <ClockCircleOutlined />
                      {relativeFromNow(item.changedAt)}
                    </span>
                  </Tooltip>
                  <span className="vf-sh__meta-item">
                    <UserOutlined />
                    {item.changedBy.fullName}
                  </span>
                  {item.newStatus === 'arrived' && item.borderCrossingDate && (
                    <Tooltip title="Дата перетину кордону">
                      <span className="vf-sh__meta-item">
                        <FlagOutlined />
                        {dayjs(item.borderCrossingDate).format('DD.MM.YYYY')}
                      </span>
                    </Tooltip>
                  )}
                </div>

                {item.note && (
                  <div className="vf-sh__callout">
                    <span className="vf-sh__callout-label">Примітка</span>
                    {item.note}
                  </div>
                )}

                {docSlots.length > 0 && (
                  <div className="vf-sh__docs">
                    {docSlots.map((slot) => (
                      <StatusHistoryGroupLinks
                        key={slot.key}
                        label={slot.label}
                        groupId={item[slot.key] as string}
                      />
                    ))}
                  </div>
                )}

                {itemAlerts.length > 0 && (
                  <div className="vf-sh__alerts">
                    {itemAlerts.map((alert) => (
                      <Alert key={alert.type} type="warning" message={alert.message} showIcon />
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="vf-sh__stat">
      <span className="vf-sh__stat-value">{value}</span>
      <span className="vf-sh__stat-label">{label}</span>
    </div>
  );
}
