import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetFlightData } from './widget-data';
import { WT, WFont } from './widget-theme';

interface Props {
  data: WidgetFlightData | null;
}

export function NextFlightWidget({ data }: Props) {
  if (!data) {
    return (
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: WT.card,
          borderRadius: 16,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
        }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'afterstay://' }}
      >
        <TextWidget
          text="No flights added"
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
        flexDirection: 'column',
        padding: 14,
        flexGap: 8,
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'afterstay://' }}
    >
      {/* Header: direction badge + airline + flight number */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flexGap: 8,
        }}
      >
        <FlexWidget
          style={{
            backgroundColor: WT.card2,
            borderRadius: 6,
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 3,
            paddingBottom: 3,
          }}
        >
          <TextWidget
            text={data.direction}
            style={{
              fontSize: WFont.size.xs,
              color: WT.accent,
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>
        <TextWidget
          text={data.airline ? `${data.airline} ${data.flightNumber}` : data.flightNumber}
          style={{
            fontSize: WFont.size.sm,
            color: WT.text2,
          }}
          maxLines={1}
        />
      </FlexWidget>

      {/* Route visualization: FROM ---- plane ---- TO */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexGap: 8,
          paddingTop: 4,
          paddingBottom: 4,
        }}
      >
        <TextWidget
          text={data.from}
          style={{
            fontSize: WFont.size.xl,
            fontWeight: 'bold',
            color: WT.text,
            fontFamily: WFont.mono,
          }}
        />
        <FlexWidget
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            flexGap: 4,
          }}
        >
          <FlexWidget
            style={{
              flex: 1,
              height: 1,
              backgroundColor: WT.border,
            }}
          />
          <TextWidget
            text="\u2708"
            style={{
              fontSize: WFont.size.lg,
              color: WT.accent,
            }}
          />
          <FlexWidget
            style={{
              flex: 1,
              height: 1,
              backgroundColor: WT.border,
            }}
          />
        </FlexWidget>
        <TextWidget
          text={data.to}
          style={{
            fontSize: WFont.size.xl,
            fontWeight: 'bold',
            color: WT.text,
            fontFamily: WFont.mono,
          }}
        />
      </FlexWidget>

      {/* Footer: departure time + date */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <TextWidget
          text={data.departTime}
          style={{
            fontSize: WFont.size.md,
            fontWeight: 'bold',
            color: WT.accent,
          }}
        />
        <TextWidget
          text={data.departDate}
          style={{
            fontSize: WFont.size.sm,
            color: WT.text3,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
