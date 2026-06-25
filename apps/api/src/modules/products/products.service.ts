import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateProductDto, UpdateProductDto } from '@gestao-prime/shared';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: { plans: { include: { plan: true } } },
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
      include: { plans: { include: { plan: true } } },
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
        githubRepo: dto.githubRepo || '',
        githubBranch: dto.githubBranch || 'master',
        icon: dto.icon,
        monthlyPrice: dto.monthlyPrice ? Math.round(dto.monthlyPrice * 100) : 0,
        basePrice: dto.basePrice ? Math.round(dto.basePrice * 100) : 0,
        projectId: dto.projectId,
      },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findById(id);
    const data: any = { ...dto };
    if (dto.monthlyPrice !== undefined) data.monthlyPrice = Math.round(dto.monthlyPrice * 100);
    if (dto.basePrice !== undefined) data.basePrice = Math.round(dto.basePrice * 100);
    return this.prisma.product.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.product.delete({ where: { id } });
    return { message: 'Produto removido com sucesso' };
  }
}
