import { relations } from 'drizzle-orm';
import { users } from './users.js';
import { organizations } from './organizations.js';
import { organizationMembers } from './organization-members.js';
import { financialCategories } from './dictionaries.js';
import { vehicles } from './vehicles.js';
import { vehicleStatusHistory } from './vehicle-status-history.js';
import { expenses } from './expenses.js';
import { documents } from './documents.js';
import { vehicleGalleries } from './vehicle-galleries.js';
import { vehicleGalleryItems } from './vehicle-gallery-items.js';
import { donors, organizationDonors } from './donors.js';
import { donations } from './donations.js';

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
  createdVehicleGalleries: many(vehicleGalleries, { relationName: 'createdBy' }),
  updatedVehicleGalleries: many(vehicleGalleries, { relationName: 'updatedBy' }),
  deletedVehicleGalleries: many(vehicleGalleries, { relationName: 'deletedBy' }),
  createdVehicleGalleryItems: many(vehicleGalleryItems, { relationName: 'createdBy' }),
  updatedVehicleGalleryItems: many(vehicleGalleryItems, { relationName: 'updatedBy' }),
  deletedVehicleGalleryItems: many(vehicleGalleryItems, { relationName: 'deletedBy' }),
  statusHistoryChanges: many(vehicleStatusHistory),
  createdOrganizations: many(organizations, { relationName: 'createdBy' }),
  organizationMemberships: many(organizationMembers),
  createdDonors: many(donors, { relationName: 'donorCreatedBy' }),
  addedOrganizationDonors: many(organizationDonors, { relationName: 'donorAddedBy' }),
  updatedOrganizationDonors: many(organizationDonors, { relationName: 'donorUpdatedBy' }),
  createdDonations: many(donations, { relationName: 'donationCreatedBy' }),
  updatedDonations: many(donations, { relationName: 'donationUpdatedBy' }),
  deletedDonations: many(donations, { relationName: 'donationDeletedBy' }),
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
  vehicleGalleries: many(vehicleGalleries),
  vehicleGalleryItems: many(vehicleGalleryItems),
  statusHistory: many(vehicleStatusHistory),
  donors: many(organizationDonors),
  donations: many(donations),
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

export const donorsRelations = relations(donors, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [donors.createdBy],
    references: [users.id],
    relationName: 'donorCreatedBy',
  }),
  organizations: many(organizationDonors),
  donations: many(donations),
}));

export const organizationDonorsRelations = relations(organizationDonors, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [organizationDonors.organizationId],
    references: [organizations.id],
  }),
  donor: one(donors, {
    fields: [organizationDonors.donorId],
    references: [donors.id],
  }),
  addedByUser: one(users, {
    fields: [organizationDonors.addedBy],
    references: [users.id],
    relationName: 'donorAddedBy',
  }),
  updatedByUser: one(users, {
    fields: [organizationDonors.updatedBy],
    references: [users.id],
    relationName: 'donorUpdatedBy',
  }),
  donations: many(donations),
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
  donations: many(donations),
  documents: many(documents),
  galleries: many(vehicleGalleries),
  galleryItems: many(vehicleGalleryItems),
}));

export const vehicleGalleriesRelations = relations(vehicleGalleries, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [vehicleGalleries.organizationId],
    references: [organizations.id],
  }),
  vehicle: one(vehicles, {
    fields: [vehicleGalleries.vehicleId],
    references: [vehicles.id],
  }),
  coverItem: one(vehicleGalleryItems, {
    fields: [vehicleGalleries.coverItemId],
    references: [vehicleGalleryItems.id],
    relationName: 'galleryCoverItem',
  }),
  items: many(vehicleGalleryItems, { relationName: 'galleryItems' }),
  createdByUser: one(users, {
    fields: [vehicleGalleries.createdBy],
    references: [users.id],
    relationName: 'createdBy',
  }),
  updatedByUser: one(users, {
    fields: [vehicleGalleries.updatedBy],
    references: [users.id],
    relationName: 'updatedBy',
  }),
  deletedByUser: one(users, {
    fields: [vehicleGalleries.deletedBy],
    references: [users.id],
    relationName: 'deletedBy',
  }),
}));

export const vehicleGalleryItemsRelations = relations(vehicleGalleryItems, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [vehicleGalleryItems.organizationId],
    references: [organizations.id],
  }),
  vehicle: one(vehicles, {
    fields: [vehicleGalleryItems.vehicleId],
    references: [vehicles.id],
  }),
  gallery: one(vehicleGalleries, {
    fields: [vehicleGalleryItems.galleryId],
    references: [vehicleGalleries.id],
    relationName: 'galleryItems',
  }),
  coverOfGalleries: many(vehicleGalleries, { relationName: 'galleryCoverItem' }),
  createdByUser: one(users, {
    fields: [vehicleGalleryItems.createdBy],
    references: [users.id],
    relationName: 'createdBy',
  }),
  updatedByUser: one(users, {
    fields: [vehicleGalleryItems.updatedBy],
    references: [users.id],
    relationName: 'updatedBy',
  }),
  deletedByUser: one(users, {
    fields: [vehicleGalleryItems.deletedBy],
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
  registrationDoc: one(documents, {
    fields: [vehicleStatusHistory.registrationDocId],
    references: [documents.id],
    relationName: 'registrationDoc',
  }),
  customsDeclarationDoc: one(documents, {
    fields: [vehicleStatusHistory.customsDeclarationDocId],
    references: [documents.id],
    relationName: 'customsDeclarationDoc',
  }),
  stampedCustomsDeclarationDoc: one(documents, {
    fields: [vehicleStatusHistory.stampedCustomsDeclarationDocId],
    references: [documents.id],
    relationName: 'stampedCustomsDeclarationDoc',
  }),
  transferActDraftDoc: one(documents, {
    fields: [vehicleStatusHistory.transferActDraftDocId],
    references: [documents.id],
    relationName: 'transferActDraftDoc',
  }),
  transferActSignedDoc: one(documents, {
    fields: [vehicleStatusHistory.transferActSignedDocId],
    references: [documents.id],
    relationName: 'transferActSignedDoc',
  }),
  returnActDoc: one(documents, {
    fields: [vehicleStatusHistory.returnActDocId],
    references: [documents.id],
    relationName: 'returnActDoc',
  }),
}));

export const financialCategoriesRelations = relations(financialCategories, ({ many }) => ({
  expenses: many(expenses),
  donations: many(donations),
}));

export const donationsRelations = relations(donations, ({ one }) => ({
  organization: one(organizations, {
    fields: [donations.organizationId],
    references: [organizations.id],
  }),
  organizationDonor: one(organizationDonors, {
    fields: [donations.organizationId, donations.donorId],
    references: [organizationDonors.organizationId, organizationDonors.donorId],
  }),
  donor: one(donors, {
    fields: [donations.donorId],
    references: [donors.id],
  }),
  vehicle: one(vehicles, {
    fields: [donations.vehicleId],
    references: [vehicles.id],
  }),
  category: one(financialCategories, {
    fields: [donations.categoryId],
    references: [financialCategories.id],
  }),
  createdByUser: one(users, {
    fields: [donations.createdBy],
    references: [users.id],
    relationName: 'donationCreatedBy',
  }),
  updatedByUser: one(users, {
    fields: [donations.updatedBy],
    references: [users.id],
    relationName: 'donationUpdatedBy',
  }),
  deletedByUser: one(users, {
    fields: [donations.deletedBy],
    references: [users.id],
    relationName: 'donationDeletedBy',
  }),
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
  category: one(financialCategories, {
    fields: [expenses.categoryId],
    references: [financialCategories.id],
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
