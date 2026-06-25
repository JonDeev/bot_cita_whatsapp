export const CHAT_THREAD_BOTTOM_THRESHOLD_PX = 48;

export interface ScrollMetrics {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

export interface PreservedScrollPosition {
  previousScrollHeight: number;
  previousScrollTop: number;
  nextScrollHeight: number;
  clientHeight: number;
}

export function isNearBottom(metrics: ScrollMetrics): boolean {
  return (
    metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <=
    CHAT_THREAD_BOTTOM_THRESHOLD_PX
  );
}

export function getScrollTopForLatest(metrics: ScrollMetrics): number {
  return Math.max(metrics.scrollHeight - metrics.clientHeight, 0);
}

export function getPreservedScrollTop({
  previousScrollHeight,
  previousScrollTop,
  nextScrollHeight,
}: PreservedScrollPosition): number {
  const delta = nextScrollHeight - previousScrollHeight;
  return Math.max(previousScrollTop + delta, 0);
}
