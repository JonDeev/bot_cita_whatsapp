import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { liveFeedQueryKey, overviewQueryKey } from './overview.hooks';
import type { AdminLiveFeedEventType, AdminStreamEvent } from './overview.types';
import { conversationsQueryKey } from '../conversations/conversations.hooks';
import { chatsQueryKey } from '../chats/chats.hooks';
import { logsQueryKey } from '../logs/logs.hooks';
import { remindersQueryKey } from '../reminders/reminders.hooks';
import { surveysQueryKey } from '../surveys/surveys.hooks';
import { clearAdminClientState } from '../auth/admin-session-client-state';

export type StreamConnectionStatus = 'connecting' | 'connected' | 'disconnected';

const eventTypes: AdminLiveFeedEventType[] = [
  'message.inbound',
  'message.outbound',
  'outbox.failed',
  'webhook.failed',
  'reminder.failed',
  'survey.completed',
  'system.degraded',
  'auth.session.revoked',
  'heartbeat',
];

const criticalEvents = new Set<AdminLiveFeedEventType>([
  'outbox.failed',
  'webhook.failed',
  'reminder.failed',
  'system.degraded',
]);

function parseStreamEvent(raw: string): AdminStreamEvent | null {
  try {
    return JSON.parse(raw) as AdminStreamEvent;
  } catch {
    return null;
  }
}

export function useAdminStream() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [status, setStatus] = useState<StreamConnectionStatus>('connecting');

  useEffect(() => {
    const eventSource = new EventSource('/api/admin/stream', {
      withCredentials: true,
    });

    eventSource.onopen = () => {
      setStatus('connected');
    };

    eventSource.onerror = () => {
      setStatus('disconnected');
    };

    const listeners = eventTypes.map((type) => {
      const listener = (event: MessageEvent<string>) => {
        const payload = parseStreamEvent(event.data);
        if (!payload) {
          return;
        }

        if (payload.eventType === 'heartbeat') {
          setStatus('connected');
          return;
        }

        if (payload.eventType === 'auth.session.revoked') {
          clearAdminClientState(queryClient);
          toast.error('Tu sesion fue revocada. Inicia sesion nuevamente.');
          navigate('/admin/login', { replace: true });
          eventSource.close();
          return;
        }

        void queryClient.invalidateQueries({ queryKey: overviewQueryKey });
        void queryClient.invalidateQueries({ queryKey: liveFeedQueryKey });
        void queryClient.invalidateQueries({ queryKey: chatsQueryKey });
        void queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
        void queryClient.invalidateQueries({ queryKey: logsQueryKey });
        void queryClient.invalidateQueries({ queryKey: remindersQueryKey });
        void queryClient.invalidateQueries({ queryKey: surveysQueryKey });

        if (criticalEvents.has(payload.eventType)) {
          toast.error(payload.summary ?? 'Se detecto un evento critico en operacion.');
        }
      };

      eventSource.addEventListener(type, listener as EventListener);
      return { type, listener };
    });

    return () => {
      listeners.forEach(({ type, listener }) => {
        eventSource.removeEventListener(type, listener as EventListener);
      });
      eventSource.close();
    };
  }, [navigate, queryClient]);

  return useMemo(
    () => ({
      status,
      isConnected: status === 'connected',
    }),
    [status],
  );
}
