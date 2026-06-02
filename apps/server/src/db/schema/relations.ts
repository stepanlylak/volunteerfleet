import { relations } from 'drizzle-orm';
import { users } from './users.js';
import { vehicleStatuses, expenseCategories, fundingSources } from './dictionaries.js';
import { vehicles } from './vehicles.js';
import { vehicleStatusHistory } from './vehicle-status-history.js';
import { expenses } from './expenses.js';
import { documents } from './documents.js';
import { vehiclePhotos } from './vehicle-photos.js';

export const usersRelations = relations(users, ({ many }) => ({
  createdVehicles: many(vehicles, { relationName: 'createdBy' }),
  updatedVehicles: many(vehicles, { relationName: 'updatedBy' }),
  deletedVehicles: many(vehicles, { relationName: 'deletedBy' }),
  createdExpenses: many(expenses, { relationName: 'createdBy' }),
  updatedExpenses: many(expenses, { relationName: 'updatedBy' }),
  deletedExpenses: many(expenses, { relationName: 'deletedBy' }),
  createdDocuments: many(documents, { relationName: 'createdBy' }),
  updatedDocuments: many(documents, { relationName: 'updatedBy' }),
  deletedDocuments: many(documents, { relationName: 'deletedBy' }),
  createdVehiclePhotos: many(vehiclePhotos, { relationName: 'createdBy' }),
  updatedVehiclePhotos: many(vehiclePhotos, { relationName: 'updatedBy' }),
  deletedVehiclePhotos: many(vehiclePhotos, { relationName: 'deletedBy' }),
  statusHistoryChanges: many(vehicleStatusHistory),
}));

export const vehicleStatusesRelations = relations(vehicleStatuses, ({ many }) => ({
  vehicles: many(vehicles),
  oldStatusHistory: many(vehicleStatusHistory, { relationName: 'oldStatus' }),
  newStatusHistory: many(vehicleStatusHistory, { relationName: 'newStatus' }),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  status: one(vehicleStatuses, {
    fields: [vehicles.statusId],
    references: [vehicleStatuses.id],
  }),
  createdByUser: one(users, {
    fields: [vehicles.createdBy],
    references: [users.id],
    relationName: 'createdBy',
  }),
  updatedByUser: one(users, {
    fields: [vehicles.updatedBy],
    references: [users.id],
    relationName: 'updatedBy',
  }),
  deletedByUser: one(users, {
    fields: [vehicles.deletedBy],
    references: [users.id],
    relationName: 'deletedBy',
  }),
  statusHistory: many(vehicleStatusHistory),
  expenses: many(expenses),
  documents: many(documents),
  photos: many(vehiclePhotos),
}));

export const vehiclePhotosRelations = relations(vehiclePhotos, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [vehiclePhotos.vehicleId],
    references: [vehicles.id],
  }),
  createdByUser: one(users, {
    fields: [vehiclePhotos.createdBy],
    references: [users.id],
    relationName: 'createdBy',
  }),
  updatedByUser: one(users, {
    fields: [vehiclePhotos.updatedBy],
    references: [users.id],
    relationName: 'updatedBy',
  }),
  deletedByUser: one(users, {
    fields: [vehiclePhotos.deletedBy],
    references: [users.id],
    relationName: 'deletedBy',
  }),
}));

export const vehicleStatusHistoryRelations = relations(vehicleStatusHistory, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [vehicleStatusHistory.vehicleId],
    references: [vehicles.id],
  }),
  oldStatus: one(vehicleStatuses, {
    fields: [vehicleStatusHistory.oldStatusId],
    references: [vehicleStatuses.id],
    relationName: 'oldStatus',
  }),
  newStatus: one(vehicleStatuses, {
    fields: [vehicleStatusHistory.newStatusId],
    references: [vehicleStatuses.id],
    relationName: 'newStatus',
  }),
  changedByUser: one(users, {
    fields: [vehicleStatusHistory.changedBy],
    references: [users.id],
  }),
}));

export const expenseCategoriesRelations = relations(expenseCategories, ({ many }) => ({
  expenses: many(expenses),
}));

export const fundingSourcesRelations = relations(fundingSources, ({ many }) => ({
  expenses: many(expenses),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  vehicle: one(vehicles, {
    fields: [expenses.vehicleId],
    references: [vehicles.id],
  }),
  category: one(expenseCategories, {
    fields: [expenses.categoryId],
    references: [expenseCategories.id],
  }),
  fundingSource: one(fundingSources, {
    fields: [expenses.fundingSourceId],
    references: [fundingSources.id],
  }),
  createdByUser: one(users, {
    fields: [expenses.createdBy],
    references: [users.id],
    relationName: 'createdBy',
  }),
  updatedByUser: one(users, {
    fields: [expenses.updatedBy],
    references: [users.id],
    relationName: 'updatedBy',
  }),
  deletedByUser: one(users, {
    fields: [expenses.deletedBy],
    references: [users.id],
    relationName: 'deletedBy',
  }),
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [documents.vehicleId],
    references: [vehicles.id],
  }),
  expense: one(expenses, {
    fields: [documents.expenseId],
    references: [expenses.id],
  }),
  createdByUser: one(users, {
    fields: [documents.createdBy],
    references: [users.id],
    relationName: 'createdBy',
  }),
  updatedByUser: one(users, {
    fields: [documents.updatedBy],
    references: [users.id],
    relationName: 'updatedBy',
  }),
  deletedByUser: one(users, {
    fields: [documents.deletedBy],
    references: [users.id],
    relationName: 'deletedBy',
  }),
}));
