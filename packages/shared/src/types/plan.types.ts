export enum PlanInterval {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMESTRAL = 'semestral',
  YEARLY = 'yearly',
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  interval: PlanInterval;
  intervalCount: number;
  features: string[];
  active: boolean;
  products?: { product: { id: string; name: string; slug: string; githubRepo: string } }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanDto {
  name: string;
  description?: string;
  price: number;
  interval: PlanInterval;
  intervalCount: number;
  features?: string[];
  productIds?: string[];
}

export interface UpdatePlanDto extends Partial<CreatePlanDto> {
  active?: boolean;
}
