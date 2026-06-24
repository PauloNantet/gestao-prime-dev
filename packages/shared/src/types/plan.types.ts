export interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  interval: string;
  intervalCount: number;
  features: string[];
  maxUsers: number;
  unlimitedUsers: boolean;
  hasSupport: boolean;
  hasUpdates: boolean;
  savings: string;
  active: boolean;
  products?: { product: { id: string; name: string; slug: string; githubRepo: string } }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanDto {
  name: string;
  description?: string;
  price: number;
  interval: string;
  intervalCount: number;
  features?: string[];
  productIds?: string[];
  maxUsers?: number;
  unlimitedUsers?: boolean;
  hasSupport?: boolean;
  hasUpdates?: boolean;
}

export interface UpdatePlanDto extends Partial<CreatePlanDto> {
  active?: boolean;
}
