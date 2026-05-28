import { Injectable } from '@nestjs/common';

const DEFAULT_LOOKBACK_HOURS = 24;
const DEFAULT_LIVE_FEED_LIMIT = 50;
const MIN_LOOKBACK_HOURS = 1;
const MAX_LOOKBACK_HOURS = 168;
const MIN_LIVE_FEED_LIMIT = 10;
const MAX_LIVE_FEED_LIMIT = 200;

@Injectable()
export class AdminOverviewConfigService {
  getLookbackHours(): number {
    const value = process.env.ADMIN_OVERVIEW_LOOKBACK_HOURS;
    if (!value || value.trim().length === 0) {
      return DEFAULT_LOOKBACK_HOURS;
    }

    const parsed = Number.parseInt(value, 10);
    if (
      !Number.isInteger(parsed) ||
      parsed < MIN_LOOKBACK_HOURS ||
      parsed > MAX_LOOKBACK_HOURS
    ) {
      throw new Error(
        `Invalid ADMIN_OVERVIEW_LOOKBACK_HOURS value "${value}". Expected integer between ${MIN_LOOKBACK_HOURS} and ${MAX_LOOKBACK_HOURS}.`,
      );
    }

    return parsed;
  }

  getLiveFeedLimit(): number {
    const value = process.env.ADMIN_LIVE_FEED_LIMIT;
    if (!value || value.trim().length === 0) {
      return DEFAULT_LIVE_FEED_LIMIT;
    }

    const parsed = Number.parseInt(value, 10);
    if (
      !Number.isInteger(parsed) ||
      parsed < MIN_LIVE_FEED_LIMIT ||
      parsed > MAX_LIVE_FEED_LIMIT
    ) {
      throw new Error(
        `Invalid ADMIN_LIVE_FEED_LIMIT value "${value}". Expected integer between ${MIN_LIVE_FEED_LIMIT} and ${MAX_LIVE_FEED_LIMIT}.`,
      );
    }

    return parsed;
  }
}
