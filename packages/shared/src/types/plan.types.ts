export interface Plan {
  id: string;
  name: string;
  dailyRate: number;
  validityDays: number;
  price: number;
  discount: number;
  discountedPrice: number;
  savings: number;
  maxUsers: number;
  unlimitedUsers: boolean;
  hasSupport: boolean;
  hasUpdates: boolean;
  active: boolean;
  position: number;
  productId: string;
  product?: { id: string; name: string; slug: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanDto {
  name: string;
  dailyRate: number;
  validityDays?: number;
  discount?: number;
  maxUsers?: number;
  unlimitedUsers?: boolean;
  hasSupport?: boolean;
  hasUpdates?: boolean;
  productId: string;
}

export interface UpdatePlanDto extends Partial<CreatePlanDto> {
  active?: boolean;
}
