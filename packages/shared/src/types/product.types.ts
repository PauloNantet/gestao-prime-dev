export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  githubRepo: string;
  githubBranch: string;
  projectId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDto {
  name: string;
  slug: string;
  description?: string;
  price?: number;
  githubRepo?: string;
  githubBranch?: string;
  projectId?: string;
}

export interface UpdateProductDto extends Partial<CreateProductDto> {
  active?: boolean;
}
