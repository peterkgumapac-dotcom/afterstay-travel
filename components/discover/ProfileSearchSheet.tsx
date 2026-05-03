import { Image } from 'expo-image';
import { Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { PAPER } from '@/components/feed/feedTheme';
import { searchProfiles, type ProfileSearchResult } from '@/lib/supabase';

interface ProfileSearchSheetProps {
  visible: boolean;
  onClose: () => void;
}

const SEARCH_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Search is taking too long. Try again.')), SEARCH_TIMEOUT_MS);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      }, (error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export default function ProfileSearchSheet({ visible, onClose }: ProfileSearchSheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      requestRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      setQuery('');
      setResults([]);
      setError(null);
      setLoading(false);
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      requestRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    setError(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (text.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const requestId = ++requestRef.current;
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await withTimeout(searchProfiles(text));
        if (requestId !== requestRef.current) return;
        setResults(data);
      } catch (err) {
        if (requestId !== requestRef.current) return;
        setResults([]);
        setError(err instanceof Error ? err.message : 'Search failed. Try again.');
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    }, 300);
  }, []);

  const handleSelect = useCallback((profile: ProfileSearchResult) => {
    onClose();
    setTimeout(() => {
      router.push({ pathname: '/profile/[userId]', params: { userId: profile.id } } as never);
    }, 200);
  }, [onClose, router]);

  const renderItem = useCallback(({ item }: { item: ProfileSearchResult }) => (
    <TouchableOpacity
      style={styles.resultRow}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      {item.avatarUrl ? (
        <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitial}>
            {(item.fullName ?? '?')[0].toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.resultText}>
        <Text style={styles.resultName} numberOfLines={1}>{item.fullName}</Text>
        {item.handle && (
          <Text style={styles.resultHandle} numberOfLines={1}>@{item.handle}</Text>
        )}
      </View>
    </TouchableOpacity>
  ), [handleSelect]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.root, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.searchBar}>
          <View style={styles.inputWrap}>
            <Search size={16} color={PAPER.inkLight} strokeWidth={1.8} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Search @handle or name..."
              placeholderTextColor={PAPER.inkLight}
              value={query}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => handleSearch(query)}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <X size={16} color={PAPER.inkLight} strokeWidth={1.8} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={PAPER.stamp} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => handleSearch(query)} activeOpacity={0.75}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        ) : query.length >= 2 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No travelers found</Text>
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.hintText}>Search by @handle or name</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PAPER.ivory,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 19,
    backgroundColor: PAPER.ivoryClean,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PAPER.rule,
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: PAPER.inkDark,
    padding: 0,
  },
  cancelBtn: {
    paddingVertical: 6,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: PAPER.stamp,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PAPER.rule,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarPlaceholder: {
    backgroundColor: PAPER.postcardEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 17,
    fontWeight: '700',
    color: PAPER.postcardInk,
  },
  resultText: {
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: PAPER.inkDark,
  },
  resultHandle: {
    fontSize: 13,
    color: PAPER.inkLight,
    marginTop: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyText: {
    fontSize: 15,
    color: PAPER.inkLight,
    textAlign: 'center',
  },
  hintText: {
    fontSize: 14,
    color: PAPER.inkLight,
  },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: PAPER.inkDark,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
    color: PAPER.ivory,
  },
});
