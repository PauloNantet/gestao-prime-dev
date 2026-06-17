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
}

export interface UpdatePlanDto extends Partial<CreatePlanDto> {
  active?: boolean;
}
