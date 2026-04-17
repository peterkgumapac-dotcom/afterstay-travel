import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Modal, ScrollView, Pressable, Linking, Dimensions,
} from 'react-native';
import { Sparkles, RefreshCw, ExternalLink, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTripInsight } from '../../hooks/useTripInsight';
import { NewsItem } from '../../lib/tripInsights';

const { height: SCREEN_H } = Dimensions.get('window');

export const InsightCard: React.FC = () => {
  const { insight, loading, error, refresh } = useTripInsight();
  const [expanded, setExpanded] = useState(false);

  // Empty state during first load
  if (loading && !insight) {
    return (
      <View style={[styles.card, styles.cardLoading]}>
        <ActivityIndicator color="#a855f7" size="small" />
        <Text style={styles.loadingText}>Loading Boracay insights...</Text>
      </View>
    );
  }

  // Error state
  if (error && !insight) {
    return (
      <TouchableOpacity onPress={() => refresh()} style={[styles.card, styles.cardError]}>
        <Text style={styles.errorText}>Could not load insights. Tap to retry.</Text>
      </TouchableOpacity>
    );
  }

  if (!insight) return null;

  const newsCount = insight.newsItems.length;

  return (
    <>
      <TouchableOpacity
        onPress={() => { Haptics.selectionAsync(); setExpanded(true); }}
        activeOpacity={0.85}
        style={styles.cardWrap}
      >
        <LinearGradient
          colors={['#3b1d5a', '#1e0f2e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <Sparkles color="#c084fc" size={16} strokeWidth={2.5} />
              <Text style={styles.title}>What's Happening in Boracay</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                refresh();
              }}
              disabled={loading}
              style={styles.refreshBtn}
            >
              {loading ? (
                <ActivityIndicator color="#c084fc" size="small" />
              ) : (
                <RefreshCw color="#c084fc" size={14} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.summary} numberOfLines={2}>
            {insight.summary}
          </Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {newsCount === 0
                ? 'No major news in the last 2 weeks'
                : `${newsCount} recent update${newsCount > 1 ? 's' : ''} \u00B7 Tap to read`}
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Expanded modal */}
      <Modal
        visible={expanded}
        animationType="slide"
        transparent
        onRequestClose={() => setExpanded(false)}
      >
        <View style={styles.modalBg}>
          <Pressable style={{ flex: 1 }} onPress={() => setExpanded(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <View>
                <View style={styles.titleRow}>
                  <Sparkles color="#c084fc" size={18} />
                  <Text style={styles.modalTitle}>Boracay Right Now</Text>
                </View>
                <Text style={styles.modalSubtitle}>
                  Updated {timeAgo(insight.fetchedAt)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setExpanded(false)} style={styles.closeBtn}>
                <X color="#fff" size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLarge}>{insight.summary}</Text>
              </View>

              {insight.newsItems.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    No major news or updates in the last 2 weeks.
                    {'\n'}This is usually a good sign!
                  </Text>
                </View>
              ) : (
                insight.newsItems.map((item, i) => <NewsItemCard key={i} item={item} />)
              )}

              <TouchableOpacity onPress={() => refresh()} style={styles.refreshBottomBtn}>
                <RefreshCw color="#c084fc" size={14} />
                <Text style={styles.refreshBottomText}>Refresh now</Text>
              </TouchableOpacity>

              <Text style={styles.disclaimer}>
                AI-generated from web sources. Verify important details from original articles.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const NewsItemCard: React.FC<{ item: NewsItem }> = ({ item }) => (
  <TouchableOpacity
    onPress={() => {
      if (item.sourceUrl) {
        Haptics.selectionAsync();
        Linking.openURL(item.sourceUrl);
      }
    }}
    style={styles.newsCard}
    activeOpacity={item.sourceUrl ? 0.8 : 1}
  >
    <View style={styles.dateChip}>
      <Text style={styles.dateChipText}>{item.date}</Text>
    </View>
    <Text style={styles.newsTitle}>{item.title}</Text>
    <Text style={styles.newsSummary}>{item.summary}</Text>
    {item.sourceUrl && (
      <View style={styles.sourceRow}>
        <ExternalLink color="#8b95a5" size={12} />
        <Text style={styles.sourceText}>
          {item.sourceName || 'Read source'}
        </Text>
      </View>
    )}
  </TouchableOpacity>
);

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

const styles = StyleSheet.create({
  cardWrap: { marginHorizontal: 16, marginVertical: 10 },
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
  },
  cardLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  loadingText: { color: '#a855f7', fontSize: 13 },
  cardError: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    marginHorizontal: 16,
    marginVertical: 10,
  },
  errorText: { color: '#ef4444', fontSize: 13, textAlign: 'center' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: '#fff', fontSize: 14, fontWeight: '700' },
  refreshBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(168,85,247,0.15)',
  },
  summary: { color: '#e2e8f0', fontSize: 13, lineHeight: 19, marginBottom: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { color: '#c084fc', fontSize: 11, fontWeight: '600' },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0a0d12',
    height: SCREEN_H * 0.85,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: '#2a3040',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  modalSubtitle: { color: '#8b95a5', fontSize: 11, marginTop: 2 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1a1f27',
    alignItems: 'center', justifyContent: 'center',
  },
  summaryBox: {
    marginHorizontal: 20,
    padding: 14,
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#c084fc',
    marginBottom: 16,
  },
  summaryLarge: { color: '#e2e8f0', fontSize: 14, lineHeight: 21 },
  newsCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    backgroundColor: '#1a1f27',
    borderRadius: 12,
  },
  dateChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(192,132,252,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  dateChipText: { color: '#c084fc', fontSize: 11, fontWeight: '700' },
  newsTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  newsSummary: { color: '#cbd5e1', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#2a3040',
  },
  sourceText: { color: '#8b95a5', fontSize: 11 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#8b95a5', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  refreshBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
  },
  refreshBottomText: { color: '#c084fc', fontSize: 13, fontWeight: '600' },
  disclaimer: {
    color: '#5a6577',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
    lineHeight: 14,
  },
});
