export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  githubRepo: string;
  githubBranch: string;
  icon: string | null;
  monthlyPrice: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDto {
  name: string;
  slug: string;
  description?: string;
  githubRepo: string;
  githubBranch?: string;
  icon?: string;
  monthlyPrice?: number;
}

export interface UpdateProductDto extends Partial<CreateProductDto> {
  active?: boolean;
}
