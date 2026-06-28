import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionDbService } from '../../common/database/subscription-db.service';
import type { CreateProductDto, UpdateProductDto } from '@gestao-prime/shared';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private subscriptionDb: SubscriptionDbService,
  ) {}

  async findAll() {
    return this.prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: { plans: true },
    });
  }

  async findActive() {
    return this.prisma.product.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { plans: true },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  async create(dto: CreateProductDto) {
    const slug = dto.slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const existing = await this.prisma.product.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('Slug já está em uso');

    return this.prisma.product.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        price: dto.price ?? 0,
        githubRepo: dto.githubRepo || '',
        githubBranch: dto.githubBranch || 'master',
        projectId: dto.projectId,
      },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findById(id);
    const { slug: _slug, ...rest } = dto;
    return this.prisma.product.update({ where: { id }, data: rest });
  }

  async remove(id: string) {
    const product = await this.findById(id);

    for (const plan of product.plans) {
      await this.subscriptionDb.removeByPlan(plan.id);
    }

    await this.prisma.plan.deleteMany({ where: { productId: id } });
    await this.prisma.product.delete({ where: { id } });
    return { message: 'Produto removido com sucesso' };
  }
}
