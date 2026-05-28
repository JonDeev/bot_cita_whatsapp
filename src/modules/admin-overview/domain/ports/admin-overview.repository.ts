import type {
  AdminDispatchStatusCount,
  AdminLiveFeedItem,
} from '../admin-overview.types';

export interface AdminOverviewAggregateCounts {
  inboundMessages: number;
  outboundMessages: number;
  outboxFailed: number;
  webhookFailed: number;
  activeConversations: number;
  reminderDispatches: AdminDispatchStatusCount[];
  surveyDispatches: AdminDispatchStatusCount[];
}

export interface AdminOverviewRepository {
  getAggregateCounts(windowStart: Date): Promise<AdminOverviewAggregateCounts>;
  getRecentLiveFeed(windowStart: Date, limit: number): Promise<AdminLiveFeedItem[]>;
}
