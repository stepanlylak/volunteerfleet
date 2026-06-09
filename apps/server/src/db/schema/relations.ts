import { relations } from 'drizzle-orm';
import { users } from './users.js';
import { organizations } from './organizations.js';
import { organizationMembers } from './organization-members.js';
import { expenseCategories, fundingSources } from './dictionaries.js';
import { vehicles } from './vehicles.js';
import { vehicleStatusHistory } from './vehicle-status-history.js';
import { expenses } from './expenses.js';
import { documents } from './documents.js';
import { vehiclePhotos } from './vehicle-photos.js';

export const usersRelations = relations(users, ({ one, many }) => ({
  lastActiveOrg: one(organizations, {
    fields: [users.lastActiveOrgId],
    references: [organizations.id],
    relationName: 'lastActiveOrg',
  }),
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
  createdOrganizations: many(organizations, { relationName: 'createdBy' }),
  organizationMemberships: many(organizationMembers),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [organizations.createdBy],
    references: [users.id],
    relationName: 'createdBy',
  }),
  members: many(organizationMembers),
  lastActiveUsers: many(users, { relationName: 'lastActiveOrg' }),
  vehicles: many(vehicles),
  expenses: many(expenses),
  documents: many(documents),
  vehiclePhotos: many(vehiclePhotos),
  statusHistory: many(vehicleStatusHistory),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [vehicles.organizationId],
    references: [organizations.id],
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
  organization: one(organizations, {
    fields: [vehiclePhotos.organizationId],
    references: [organizations.id],
  }),
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
  organization: one(organizations, {
    fields: [vehicleStatusHistory.organizationId],
    references: [organizations.id],
  }),
  vehicle: one(vehicles, {
    fields: [vehicleStatusHistory.vehicleId],
    references: [vehicles.id],
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
  organization: one(organizations, {
    fields: [expenses.organizationId],
    references: [organizations.id],
  }),
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
  organization: one(organizations, {
    fields: [documents.organizationId],
    references: [organizations.id],
  }),
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
