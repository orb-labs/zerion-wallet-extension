import React, { useMemo, useState, useRef } from 'react';
import groupBy from 'lodash/groupBy';
import { startOfDate } from 'src/shared/units/startOfDate';
import { VStack } from 'src/ui/ui-kit/VStack';
import { UIText } from 'src/ui/ui-kit/UIText';
import { SurfaceList } from 'src/ui/ui-kit/SurfaceList';
import { ViewLoading } from 'src/ui/components/ViewLoading';
import { HStack } from 'src/ui/ui-kit/HStack';
import { DelayedRender } from 'src/ui/components/DelayedRender';
import { Media } from 'src/ui/ui-kit/Media';
import type { Activity } from '@orb-labs/orby-core';
import { CircleSpinner } from 'src/ui/ui-kit/CircleSpinner';
import { CenteredDialog } from 'src/ui/ui-kit/ModalDialogs/CenteredDialog';
import { Button } from 'src/ui/ui-kit/Button';
import { Surface } from 'src/ui/ui-kit/Surface';
import { TokenStateSection } from 'src/ui/components/TokenStateSection/TokenStateSection';

const ACTIVITY_ICON_SIZE = 36;

// Map activity categories to user-friendly labels and emoji icons
const CATEGORY_LABELS: Record<string, string> = {
  FUNCTION_CALL: 'Function Call',
  TRADE: 'Trade',
  APPROVE: 'Approve',
  TRANSFER: 'Transfer',
  // Add more mappings as needed
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  FUNCTION_CALL: (
    <div
      style={{
        width: ACTIVITY_ICON_SIZE,
        height: ACTIVITY_ICON_SIZE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 28,
      }}
    >
      📝
    </div>
  ),
  // Add more mappings as needed
};

function getCategoryLabel(category: string | undefined) {
  if (!category) return 'Activity';
  return (
    CATEGORY_LABELS[category] ||
    category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function getCategoryIcon(category: string | undefined) {
  if (!category)
    return (
      <div
        style={{
          width: ACTIVITY_ICON_SIZE,
          height: ACTIVITY_ICON_SIZE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
        }}
      >
        ✅
      </div>
    );
  return (
    CATEGORY_ICONS[category] || (
      <div
        style={{
          width: ACTIVITY_ICON_SIZE,
          height: ACTIVITY_ICON_SIZE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
        }}
      >
        ✅
      </div>
    )
  );
}

function getStatusColor(status: string | undefined) {
  if (!status) return undefined;
  if (status === 'FAILED') return 'var(--negative-500)';
  if (status === 'WAITING_TIMEOUT' || status === 'PENDING')
    return 'var(--notice-500)';
  if (status === 'SUCCESS') return 'var(--positive-500)';
  return undefined;
}

const dateFormatter = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function ActivityDetailedView({
  activity,
  onClose,
}: {
  activity: Activity;
  onClose: () => void;
}) {
  const firstOperation = activity.operationStatuses[0];
  const date = activity.initiateAt
    ? dateFormatter.format(new Date(activity.initiateAt))
    : '';
  return (
    <VStack
      gap={14}
      style={{ ['--surface-background-color' as string]: 'var(--white)' }}
    >
      <Button
        kind="ghost"
        value="cancel"
        size={40}
        style={{
          width: 40,
          padding: 8,
          position: 'absolute',
          top: 16,
          left: 8,
        }}
        onClick={onClose}
      >
        ←
      </Button>
      <VStack gap={0} style={{ justifyItems: 'center' }}>
        <UIText kind="body/accent" style={{ fontWeight: 600, fontSize: 22 }}>
          {getCategoryLabel(activity.category)}
        </UIText>
        {date && (
          <UIText kind="small/regular" color="var(--neutral-500)">
            {date}
          </UIText>
        )}
      </VStack>
      <VStack gap={4}>
        <TokenStateSection title="Send" tokens={activity.inputState} />
        <TokenStateSection title="Receive" tokens={activity.outputState} />
      </VStack>
      <Surface padding={16}>
        <VStack gap={16}>
          {firstOperation?.hash && (
            <HStack gap={8} alignItems="center">
              <UIText kind="small/accent">Hash:</UIText>
              <UIText kind="small/regular" style={{ wordBreak: 'break-all' }}>
                {firstOperation.hash}
              </UIText>
            </HStack>
          )}
          <HStack gap={8} alignItems="center">
            <UIText kind="small/accent">Status:</UIText>
            <UIText kind="small/regular">{activity.overallStatus}</UIText>
          </HStack>
        </VStack>
      </Surface>
    </VStack>
  );
}

function ActivityItem({ activity }: { activity: Activity }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  const status = activity.overallStatus;
  const category = activity.category;
  const label = getCategoryLabel(category);
  const icon = getCategoryIcon(category);
  const statusColor = getStatusColor(status);
  const firstOperation = activity.operationStatuses[0];
  const hash = firstOperation?.hash;
  const isFailed = status === 'FAILED';
  const isPending = status === 'WAITING_TIMEOUT' || status === 'PENDING';

  // Value display
  const value = activity.aggregateFiatValueOfOutputState;
  const valueColor =
    value && Number(value.toFixed()) > 0 ? 'var(--positive-500)' : undefined;

  return (
    <>
      <div style={{ cursor: 'pointer' }} onClick={() => setOpen(true)}>
        <Media
          vGap={0}
          gap={12}
          image={
            isFailed ? (
              <div
                style={{
                  width: ACTIVITY_ICON_SIZE,
                  height: ACTIVITY_ICON_SIZE,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                }}
              >
                ❌
              </div>
            ) : isPending ? (
              <div
                style={{
                  width: ACTIVITY_ICON_SIZE,
                  height: ACTIVITY_ICON_SIZE,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CircleSpinner
                  size={ACTIVITY_ICON_SIZE + 'px'}
                  color="var(--primary)"
                />
              </div>
            ) : (
              icon
            )
          }
          text={
            <UIText kind="body/accent" style={{ fontWeight: 600 }}>
              {label}
            </UIText>
          }
          detailText={
            <VStack gap={2} style={{ alignItems: 'flex-end', minWidth: 80 }}>
              <HStack gap={8} alignItems="center">
                <UIText
                  kind="small/regular"
                  color={statusColor}
                  style={{ fontWeight: 500 }}
                >
                  {status || 'Unknown Status'}
                </UIText>
                {hash && (
                  <UIText kind="caption/regular" color="var(--neutral-400)">
                    {hash.slice(0, 8)}...{hash.slice(-6)}
                  </UIText>
                )}
              </HStack>
              {value && (
                <UIText
                  kind="body/accent"
                  color={valueColor}
                  style={{ fontWeight: 600 }}
                >
                  ${value.toFixed(2)}
                </UIText>
              )}
              {value && (
                <UIText kind="small/regular" color="var(--neutral-500)">
                  {value.currency.symbol}
                </UIText>
              )}
            </VStack>
          }
        />
      </div>
      <CenteredDialog
        ref={dialogRef}
        open={open}
        onClose={() => setOpen(false)}
        containerStyle={{ backgroundColor: 'var(--neutral-100)' }}
        renderWhenOpen={() => (
          <ActivityDetailedView
            activity={activity}
            onClose={() => setOpen(false)}
          />
        )}
      />
    </>
  );
}

export function ActivityList({
  activities,
  hasMore,
  isLoading,
  onLoadMore,
}: {
  activities: Activity[];
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore?(): void;
}) {
  const groupedByDate = useMemo(
    () =>
      groupBy(activities, (item) =>
        startOfDate(
          item.initiateAt ? new Date(item.initiateAt).getTime() : Date.now()
        ).getTime()
      ),
    [activities]
  );

  return (
    <VStack gap={4} style={{ alignContent: 'start' }}>
      <VStack gap={24}>
        {Object.entries(groupedByDate).map(([timestamp, items]) => (
          <VStack gap={8} key={timestamp}>
            <HStack
              gap={8}
              justifyContent="space-between"
              style={{ paddingInline: 16 }}
            >
              <UIText kind="small/accent">
                {new Intl.DateTimeFormat('en', {
                  dateStyle: 'medium',
                }).format(Number(timestamp))}{' '}
              </UIText>
            </HStack>
            <SurfaceList
              gap={4}
              items={items.map((activity, index) => {
                const key = `activity-${index}-${
                  activity.initiateAt
                    ? new Date(activity.initiateAt).getTime()
                    : Date.now()
                }`;
                return {
                  key,
                  component: <ActivityItem activity={activity} />,
                };
              })}
            />
          </VStack>
        ))}
      </VStack>
      {activities.length && (isLoading || hasMore) ? (
        <SurfaceList
          items={[
            {
              key: 0,
              onClick: isLoading ? undefined : onLoadMore,
              style: { height: 40 },
              component: isLoading ? (
                <DelayedRender delay={400}>
                  <ViewLoading />
                </DelayedRender>
              ) : (
                <UIText kind="body/accent" color="var(--primary)">
                  Show More
                </UIText>
              ),
            },
          ]}
        />
      ) : null}
    </VStack>
  );
}
