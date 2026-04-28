import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { getPendingMoments } from './supabase';
import { getLocalNotificationPrefs, shouldNotify, shouldSendPush } from './notificationPrefs';

const TASK_NAME = 'photo-curation-reminder';

/**
 * Defines the background task executor.
 * Must be called outside of React components so it runs on app startup.
 */
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    // Check notification prefs first
    const prefs = await getLocalNotificationPrefs();
    if (!shouldNotify('moments_added', prefs)) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }
    if (!shouldSendPush(prefs)) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    // Check for pending/unprocessed moments
    const { count } = await getPendingMoments().catch(() => ({ moments: [], count: 0 }));
    if (count === 0) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    // Send local notification
    const Notifs = await import('expo-notifications');
    await Notifs.scheduleNotificationAsync({
      content: {
        title: count === 1 ? '1 photo ready for curation' : `${count} photos ready for curation`,
        body: 'Tap to review and organize your trip moments.',
        data: { type: 'moments_added', count },
      },
      trigger: null, // immediate
    });

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (err) {
    if (__DEV__) console.warn('[BackgroundTask] photo-curation failed:', err);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Registers the background task with the OS.
 */
export async function registerBackgroundTasks() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(TASK_NAME, {
        minimumInterval: 60 * 15, // 15 minutes
      });
    }
  } catch (err) {
    if (__DEV__) console.warn('[BackgroundTask] registration failed:', err);
  }
}

/**
 * Unregisters the background task.
 */
export async function unregisterBackgroundTasks() {
  try {
    await BackgroundTask.unregisterTaskAsync(TASK_NAME);
  } catch (err) {
    if (__DEV__) console.warn('[BackgroundTask] unregistration failed:', err);
  }
}
