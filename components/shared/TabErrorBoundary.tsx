/**
 * TabErrorBoundary — Reusable error boundary for tab screens.
 * Catches render errors and shows a retry-able fallback instead of crashing the app.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

interface Props {
  children: React.ReactNode;
  /** Optional tab name for error context */
  name?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class TabErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      console.error(`[TabErrorBoundary:${this.props.name ?? 'unknown'}]`, error, info.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.container}>
          <AlertTriangle size={40} color="#c4554a" strokeWidth={1.5} />
          <Text style={s.title}>Something went wrong</Text>
          <Text style={s.message}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
          <Pressable style={s.retryBtn} onPress={this.handleRetry}>
            <Text style={s.retryText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
    backgroundColor: '#0f0d0b',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1ebe2',
    marginTop: 8,
  },
  message: {
    fontSize: 13,
    color: '#857d70',
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#d8ab7a',
  },
  retryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f0d0b',
  },
});
