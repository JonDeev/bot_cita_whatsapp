import { useLayoutEffect, useRef, useState, type UIEvent } from 'react';
import type { ChatThreadMutation } from './chat-thread-state';
import {
  getPreservedScrollTop,
  getScrollTopForLatest,
  isNearBottom,
} from './chat-thread-viewport.logic';

interface PendingOlderMessagesPosition {
  scrollHeight: number;
  scrollTop: number;
}

interface UseChatThreadViewportOptions {
  chatId: number | null;
  mutation: ChatThreadMutation | null;
}

export function useChatThreadViewport({
  chatId,
  mutation,
}: UseChatThreadViewportOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingOlderMessagesPositionRef =
    useRef<PendingOlderMessagesPosition | null>(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const isPinnedToBottomRef = useRef(true);

  const setPinnedState = (nextValue: boolean) => {
    isPinnedToBottomRef.current = nextValue;
    setIsPinnedToBottom((currentValue) =>
      currentValue === nextValue ? currentValue : nextValue,
    );
  };

  const scrollToLatest = (behavior: ScrollBehavior = 'smooth') => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const top = getScrollTopForLatest({
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      scrollTop: node.scrollTop,
    });
    if (typeof node.scrollTo === 'function') {
      node.scrollTo({ top, behavior });
    } else {
      node.scrollTop = top;
    }

    setPinnedState(true);
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    setPinnedState(
      isNearBottom({
        clientHeight: event.currentTarget.clientHeight,
        scrollHeight: event.currentTarget.scrollHeight,
        scrollTop: event.currentTarget.scrollTop,
      }),
    );
  };

  const prepareForOlderMessages = () => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    pendingOlderMessagesPositionRef.current = {
      scrollHeight: node.scrollHeight,
      scrollTop: node.scrollTop,
    };
  };

  useLayoutEffect(() => {
    pendingOlderMessagesPositionRef.current = null;
    setPinnedState(true);
  }, [chatId]);

  useLayoutEffect(() => {
    if (!mutation) {
      return;
    }

    const node = containerRef.current;
    if (!node) {
      return;
    }

    if (mutation.type === 'THREAD_RESET') {
      scrollToLatest('auto');
      pendingOlderMessagesPositionRef.current = null;
      return;
    }

    if (mutation.type === 'OLDER_MESSAGES_PREPENDED') {
      const pendingPosition = pendingOlderMessagesPositionRef.current;
      if (!pendingPosition) {
        return;
      }

      node.scrollTop = getPreservedScrollTop({
        clientHeight: node.clientHeight,
        nextScrollHeight: node.scrollHeight,
        previousScrollHeight: pendingPosition.scrollHeight,
        previousScrollTop: pendingPosition.scrollTop,
      });
      pendingOlderMessagesPositionRef.current = null;
      return;
    }

    if (!isPinnedToBottomRef.current) {
      return;
    }

    if (
      mutation.type === 'LIVE_MESSAGE_APPENDED' ||
      mutation.type === 'LATEST_MESSAGES_REFRESHED'
    ) {
      scrollToLatest('auto');
    }
  }, [mutation]);

  return {
    containerRef,
    handleScroll,
    isPinnedToBottom,
    prepareForOlderMessages,
    scrollToLatest,
    showJumpToLatest: !isPinnedToBottom,
  };
}
