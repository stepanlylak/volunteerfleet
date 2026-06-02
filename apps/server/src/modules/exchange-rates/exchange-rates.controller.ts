import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  exchangeRateQuerySchema,
  type ExchangeRateQuery,
  type ExchangeRateResponse,
} from '@volunteerfleet/shared';
import { ExchangeRatesService } from './exchange-rates.service.js';

@ApiTags('exchange-rates')
@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Get()
  @ApiOperation({ summary: 'Get exchange rate for date and currency' })
  @ApiQuery({ name: 'date', example: '2026-05-21' })
  @ApiQuery({ name: 'currency', example: 'USD' })
  @ApiResponse({ status: 200 })
  getRate(
    @Query(new ZodValidationPipe(exchangeRateQuerySchema)) query: ExchangeRateQuery,
  ): ExchangeRateResponse {
    const date = new Date(query.date);
    const rate = this.exchangeRatesService.getRate(date, query.currency);
    return { date: query.date, currency: query.currency, rate, source: 'default' };
  }
}
