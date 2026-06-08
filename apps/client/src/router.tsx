import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AuthGuard } from './components/guards/AuthGuard';
import { RoleGuard } from './components/guards/RoleGuard';
import { AppLayout } from './components/layout/AppLayout';
import { PublicLayout } from './components/layout/PublicLayout';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { ForbiddenPage } from './pages/forbidden/ForbiddenPage';
import { LoginPage } from './pages/login/LoginPage';
import { NotFoundPage } from './pages/not-found/NotFoundPage';
import { DictionariesPage } from './pages/admin/DictionariesPage';
import { FundingSourceReportPage } from './pages/FundingSourceReportPage';
import { PublicFundingReportPage } from './pages/public/PublicFundingReportPage';
import { PublicVehiclePage } from './pages/public/PublicVehiclePage';
import { ReportsIndexPage } from './pages/ReportsIndexPage';
import { UsersPage } from './pages/admin/UsersPage';
import { VehicleCardPage } from './pages/vehicles/VehicleCardPage';
import { VehicleReportPage } from './pages/VehicleReportPage';
import { ExpensesListPage } from './pages/expenses/ExpensesListPage';
import { VehiclesListPage } from './pages/vehicles/VehiclesListPage';
import { OrganizationsPage } from './pages/admin/OrganizationsPage';
import { OrganizationMembersPage } from './pages/admin/OrganizationMembersPage';
import { MyOrganizationPage } from './pages/my-organization/MyOrganizationPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'vehicles', element: <VehiclesListPage /> },
      { path: 'vehicles/:id', element: <VehicleCardPage /> },
      { path: 'expenses', element: <ExpensesListPage /> },
      {
        path: 'reports',
        children: [
          { index: true, element: <ReportsIndexPage /> },
          { path: 'vehicle/:id', element: <VehicleReportPage /> },
          { path: 'funding/:id', element: <FundingSourceReportPage /> },
        ],
      },
      {
        path: 'admin',
        element: (
          <RoleGuard roles={['superuser']}>
            <Outlet />
          </RoleGuard>
        ),
        children: [
          { path: 'users', element: <UsersPage /> },
          { path: 'dictionaries', element: <DictionariesPage /> },
          { path: 'organizations', element: <OrganizationsPage /> },
          { path: 'organizations/:id/members', element: <OrganizationMembersPage /> },
        ],
      },
      { path: 'my-organization', element: <MyOrganizationPage /> },
    ],
  },
  // Public pages for unauthenticated visitors — separate layout without sidebar
  {
    path: '/public',
    element: <PublicLayout />,
    children: [
      { path: ':orgId/vehicles/:vehicleId', element: <PublicVehiclePage /> },
      { path: ':orgId/reports/funding/:id', element: <PublicFundingReportPage /> },
    ],
  },
  // Error pages
  { path: '/403', element: <ForbiddenPage /> },
  { path: '*', element: <NotFoundPage /> },
]);
