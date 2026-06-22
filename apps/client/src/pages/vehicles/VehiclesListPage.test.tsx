import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { VehicleResponse, VehicleStatus } from '@volunteerfleet/shared';
import { VehiclesListPage } from './VehiclesListPage';

// Mock the auth store
vi.mock('../../stores/auth.store', () => {
  const user = {
    activeOrgId: 'org-1',
    userRole: 'coordinator',
    orgRole: 'coordinator',
    memberships: [],
  };
  const state = { user, hasSessionHint: true, setAuth: vi.fn(), clear: vi.fn() };
  return {
    useAuth: vi.fn((selector?: (s: typeof state) => unknown) =>
      selector ? selector(state) : state,
    ),
    useOrgRole: vi.fn(() => 'coordinator'),
  };
});

// Mock the vehicles hook
vi.mock('../../hooks/useVehicles', () => ({
  useVehicles: vi.fn(),
}));

// Mock the vehicle form modal to avoid pulling in unrelated hooks
vi.mock('../../modals/VehicleFormModal', () => ({
  VehicleFormModal: () => null,
}));

import { useVehicles } from '../../hooks/useVehicles';

const mockUseVehicles = vi.mocked(useVehicles);

function createMockVehicle(overrides: Partial<VehicleResponse> = {}): VehicleResponse {
  return {
    id: 'veh-1',
    identifier: 'TEST-001',
    brand: 'Toyota',
    model: 'Hilux',
    year: 2020,
    vin: 'ABC123',
    startDate: '2024-01-01',
    borderCrossingDate: null,
    status: 'new' as VehicleStatus,
    description: null,
    isPublic: true,
    publicSummary: null,
    publicCollectedAmountUahMinor: null,
    publicGoalAmountUahMinor: null,
    createdBy: { id: 'user-1', fullName: 'Test User' },
    updatedBy: { id: 'user-1', fullName: 'Test User' },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    deletedAt: null,
    deletedBy: null,
    alerts: [],
    mainGalleryCover: null,
    ...overrides,
  };
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('VehiclesListPage cover column', () => {
  it('renders placeholder when mainGalleryCover is null', () => {
    mockUseVehicles.mockReturnValue({
      data: {
        items: [createMockVehicle({ mainGalleryCover: null })],
        total: 1,
        page: 1,
        pageSize: 20,
      },
      isFetching: false,
    } as ReturnType<typeof useVehicles>);

    renderWithProviders(<VehiclesListPage />);

    expect(screen.getByText('Немає фото')).toBeInTheDocument();
  });

  it('renders cover image when mainGalleryCover is present', () => {
    mockUseVehicles.mockReturnValue({
      data: {
        items: [
          createMockVehicle({
            mainGalleryCover: { itemId: 'cover-item-1', mimeType: 'image/jpeg' },
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
      isFetching: false,
    } as ReturnType<typeof useVehicles>);

    renderWithProviders(<VehiclesListPage />);

    const img = screen.getByAltText('Toyota Hilux');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/api/v1/public/gallery-items/cover-item-1/download');
  });

  it('does not break when multiple vehicles with mixed cover states', () => {
    mockUseVehicles.mockReturnValue({
      data: {
        items: [
          createMockVehicle({
            id: 'veh-1',
            identifier: 'WITH-COVER',
            brand: 'Toyota',
            model: 'Hilux',
            mainGalleryCover: { itemId: 'cover-1', mimeType: 'image/jpeg' },
          }),
          createMockVehicle({
            id: 'veh-2',
            identifier: 'NO-COVER',
            brand: 'Ford',
            model: 'Ranger',
            mainGalleryCover: null,
          }),
          createMockVehicle({
            id: 'veh-3',
            identifier: 'WITH-COVER-2',
            brand: 'Nissan',
            model: 'Navara',
            mainGalleryCover: { itemId: 'cover-2', mimeType: 'image/png' },
          }),
        ],
        total: 3,
        page: 1,
        pageSize: 20,
      },
      isFetching: false,
    } as ReturnType<typeof useVehicles>);

    renderWithProviders(<VehiclesListPage />);

    // Should have 2 cover images and 1 placeholder
    expect(screen.getAllByAltText(/Toyota Hilux|Nissan Navara/)).toHaveLength(2);
    expect(screen.getByText('Немає фото')).toBeInTheDocument();
  });
});
