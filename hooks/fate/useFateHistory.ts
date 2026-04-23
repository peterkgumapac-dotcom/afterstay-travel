import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'fate_decides_history';
const MAX_ENTRIES = 5;

export interface FateResult {
  id: string;
  mode: 'wheel' | 'touch';
  winner: string;
  duoWinner?: string;
  timestamp: number;
}

export interface UseFateHistoryReturn {
  history: FateResult[];
  addResult: (result: Omit<FateResult, 'id' | 'timestamp'>) => Promise<void>;
  clearHistory: () => Promise<void>;
  recentWinners: string[];
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function useFateHistory(): UseFateHistoryReturn {
  const [history, setHistory] = useState<FateResult[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setHistory(parsed.slice(0, MAX_ENTRIES));
          }
        } catch {
          // ignore corrupt data
        }
      }
    });
  }, []);

  const addResult = useCallback(
    async (result: Omit<FateResult, 'id' | 'timestamp'>) => {
      const entry: FateResult = {
        ...result,
        id: generateId(),
        timestamp: Date.now(),
      };
      const next = [entry, ...history].slice(0, MAX_ENTRIES);
      setHistory(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    },
    [history],
  );

  const clearHistory = useCallback(async () => {
    setHistory([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const recentWinners = history.map((r) => r.winner);

  return { history, addResult, clearHistory, recentWinners };
}
