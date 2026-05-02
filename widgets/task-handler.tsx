import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { TripCountdownWidget } from './TripCountdownWidget';
import { NextFlightWidget } from './NextFlightWidget';
import { DailyBudgetWidget } from './DailyBudgetWidget';
import { getWidgetTripData, getWidgetFlightData, getWidgetBudgetData } from './widget-data';

function fallbackWidget(widgetName: string): React.ReactElement {
  switch (widgetName) {
    case 'NextFlight':
      return <NextFlightWidget data={null} />;
    case 'DailyBudget':
      return <DailyBudgetWidget data={null} />;
    default:
      return <TripCountdownWidget data={null} />;
  }
}

async function fetchAndRender(widgetName: string): Promise<React.ReactElement> {
  switch (widgetName) {
    case 'TripCountdown': {
      const data = await getWidgetTripData();
      return <TripCountdownWidget data={data} />;
    }
    case 'NextFlight': {
      const data = await getWidgetFlightData();
      return <NextFlightWidget data={data} />;
    }
    case 'DailyBudget': {
      const data = await getWidgetBudgetData();
      return <DailyBudgetWidget data={data} />;
    }
    default:
      return <TripCountdownWidget data={null} />;
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const widgetName = props.widgetInfo.widgetName;

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      try {
        const widget = await fetchAndRender(widgetName);
        await props.renderWidget(widget);
      } catch {
        await props.renderWidget(fallbackWidget(widgetName));
      }
      break;
    }
    case 'WIDGET_CLICK':
    case 'WIDGET_DELETED':
      break;
  }
}
