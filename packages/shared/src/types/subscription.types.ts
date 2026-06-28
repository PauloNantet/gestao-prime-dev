import { EntityStatus } from './tenant.types';

export type SubscriptionStatus = EntityStatus;

export interface Subscription {
  id: string;
  planId: string;
  planName: string;
  planDailyRate: number;
  planValidityDays: number;
  planPrice: number;
  planDiscount: number;
  planDiscountedPrice: number;
  status: SubscriptionStatus;
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
  validityDays: number;
  maxUsers: number;
  unlimitedUsers: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSubscriptionRow {
  id: string;
  plan_id: string;
  plan_name: string;
  plan_daily_rate: number;
  plan_validity_days: number;
  plan_price: number;
  plan_discount: number;
  plan_discounted_price: number;
  status: string;
  starts_at: string;
  ends_at: string;
  cancelled_at: string | null;
  validity_days: number;
  max_users: number;
  unlimited_users: boolean;
  created_at: string;
  updated_at: string;
}
