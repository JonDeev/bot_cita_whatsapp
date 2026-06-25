import {
  getPreservedScrollTop,
  getScrollTopForLatest,
  isNearBottom,
} from '../src/features/chats/chat-thread-viewport.logic';

describe('chat thread viewport logic', () => {
  it('detects when the viewport is near the bottom', () => {
    expect(
      isNearBottom({
        clientHeight: 100,
        scrollHeight: 420,
        scrollTop: 272,
      }),
    ).toBe(true);

    expect(
      isNearBottom({
        clientHeight: 100,
        scrollHeight: 420,
        scrollTop: 200,
      }),
    ).toBe(false);
  });

  it('calculates the latest scroll position without overshooting', () => {
    expect(
      getScrollTopForLatest({
        clientHeight: 100,
        scrollHeight: 420,
        scrollTop: 0,
      }),
    ).toBe(320);
  });

  it('preserves scroll position when older messages are prepended', () => {
    expect(
      getPreservedScrollTop({
        clientHeight: 100,
        previousScrollHeight: 420,
        previousScrollTop: 180,
        nextScrollHeight: 560,
      }),
    ).toBe(320);
  });
});
