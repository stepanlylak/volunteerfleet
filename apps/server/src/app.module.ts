import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { DictionariesModule } from './modules/dictionaries/dictionaries.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { ExchangeRatesModule } from './modules/exchange-rates/exchange-rates.module.js';
import { ExpensesModule } from './modules/expenses/expenses.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { PublicModule } from './modules/public/public.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { VehiclesModule } from './modules/vehicles/vehicles.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { AppController } from './app.controller.js';

@Module({
  imports: [
    AppConfigModule,
    DbModule,
    HealthModule,
    AuthModule,
    DashboardModule,
    DictionariesModule,
    ExchangeRatesModule,
    UsersModule,
    VehiclesModule,
    ExpensesModule,
    DocumentsModule,
    ReportsModule,
    PublicModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
