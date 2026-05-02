import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetBudgetData, WidgetBudgetBar } from './widget-data';
import { WT, WFont } from './widget-theme';

const BAR_MAX_WIDTH = 140;

interface Props {
  data: WidgetBudgetData | null;
}

function CategoryRow({ bar }: { bar: WidgetBudgetBar }) {
  const fillWidth = Math.max(Math.round((bar.percent / 100) * BAR_MAX_WIDTH), 4);
  return (
    <FlexWidget style={{ flexDirection: 'column', marginBottom: 4 }}>
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
        <TextWidget text={bar.category} style={{ fontSize: 11, color: WT.text2 }} />
        <TextWidget text={bar.amount} style={{ fontSize: 11, color: WT.text, fontWeight: 'bold' }} />
      </FlexWidget>
      <FlexWidget style={{ height: 4, width: BAR_MAX_WIDTH, backgroundColor: WT.border, borderRadius: 2 }}>
        <FlexWidget style={{ height: 4, width: fillWidth, backgroundColor: bar.color as typeof WT.accent, borderRadius: 2 }} />
      </FlexWidget>
    </FlexWidget>
  );
}

function EmptyRow({ category }: { category: string }) {
  return (
    <FlexWidget style={{ flexDirection: 'column', marginBottom: 4 }}>
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
        <TextWidget text={category} style={{ fontSize: 11, color: WT.text3 }} />
        <TextWidget text="--" style={{ fontSize: 11, color: WT.textDim }} />
      </FlexWidget>
      <FlexWidget style={{ height: 4, width: BAR_MAX_WIDTH, backgroundColor: WT.border, borderRadius: 2 }} />
    </FlexWidget>
  );
}

export function DailyBudgetWidget({ data }: Props) {
  const label = data?.label?.toUpperCase() ?? 'TODAY';
  const total = data?.total ?? '₱0';
  const count = data?.count ?? 0;
  const bars = data?.bars ?? [];

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: WT.card,
        borderRadius: 16,
        flexDirection: 'row',
        padding: 14,
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'afterstay://' }}
    >
      {/* Left column */}
      <FlexWidget style={{ width: 120, flexDirection: 'column', justifyContent: 'center' }}>
        <FlexWidget style={{ marginBottom: 2 }}>
          <TextWidget text={label} style={{ fontSize: WFont.size.xs, color: WT.text3, fontWeight: 'bold' }} />
        </FlexWidget>
        <FlexWidget style={{ marginBottom: 4 }}>
          <TextWidget text={total} style={{ fontSize: 24, fontWeight: 'bold', color: WT.text }} />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: WT.accent, marginRight: 6 }} />
          <TextWidget text={`${count} expense${count === 1 ? '' : 's'}`} style={{ fontSize: WFont.size.sm, color: WT.text2 }} />
        </FlexWidget>
      </FlexWidget>

      {/* Right column */}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', justifyContent: 'center', marginLeft: 8 }}>
        {bars.length > 0 && bars[0] ? <CategoryRow bar={bars[0]} /> : <EmptyRow category="Food" />}
        {bars.length > 1 && bars[1] ? <CategoryRow bar={bars[1]} /> : <EmptyRow category="Activity" />}
        {bars.length > 2 && bars[2] ? <CategoryRow bar={bars[2]} /> : <EmptyRow category="Transport" />}
        {bars.length > 3 && bars[3] ? <CategoryRow bar={bars[3]} /> : <EmptyRow category="Shopping" />}
      </FlexWidget>
    </FlexWidget>
  );
}
