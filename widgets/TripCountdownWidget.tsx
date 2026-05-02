import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetTripData } from './widget-data';
import { WT, WFont } from './widget-theme';

interface Props {
  data: WidgetTripData | null;
}

export function TripCountdownWidget({ data }: Props) {
  if (!data) {
    return (
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: WT.card,
          borderRadius: 16,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 12,
        }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'afterstay://' }}
      >
        <TextWidget
          text="No upcoming trips"
          style={{
            fontSize: WFont.size.md,
            color: WT.text3,
          }}
        />
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: WT.card,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        flexGap: 10,
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'afterstay://' }}
    >
      {/* Accent dot */}
      <FlexWidget
        style={{
          width: 8,
          height: 8,
          backgroundColor: data.isActive ? WT.accent : WT.accentDk,
          borderRadius: 4,
        }}
      />

      {/* Destination */}
      <FlexWidget
        style={{
          flex: 1,
          flexDirection: 'column',
          flexGap: 2,
        }}
      >
        <TextWidget
          text={data.destination}
          style={{
            fontSize: WFont.size.md,
            fontWeight: 'bold',
            color: WT.text,
          }}
          maxLines={1}
        />
        <TextWidget
          text={data.statusLabel}
          style={{
            fontSize: WFont.size.sm,
            color: WT.accent,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
