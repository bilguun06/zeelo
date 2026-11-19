import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsInt, Matches, Max, Min } from 'class-validator';
import { ProductsService } from './products.service';
import { toProductDto } from './products.mapper';

export class QuoteRequestDto {
  @ApiProperty({ example: '2000000.00' }) @Matches(/^\d{1,13}(\.\d{1,2})?$/)
  amount: string;

  @ApiProperty({ example: 12 }) @IsInt() @Min(1) @Max(120)
  termMonths: number;
}

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List customer-visible loan products (ACTIVE + authorized only)' })
  list() {
    return this.products.listPublic();
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return toProductDto(await this.products.getPublic(id));
  }

  @Post(':id/quote')
  @HttpCode(200)
  @ApiOperation({ summary: 'Indicative quote with full schedule using the product’s configured pricing (not an offer)' })
  quote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: QuoteRequestDto) {
    return this.products.quote(id, dto.amount, dto.termMonths);
  }
}
