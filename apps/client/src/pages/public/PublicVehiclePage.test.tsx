import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { PublicVehicleResponse } from '@volunteerfleet/shared';
import { PublicVehiclePage } from './PublicVehiclePage';

// Mock the public API
vi.mock('../../api/public.api', () => ({
  publicApi: {
    getVehicle: vi.fn(),
    getGalleryItemDownloadUrl: (itemId: string) =>
      `/api/v1/public/gallery-items/${itemId}/download`,
  },
}));

import { publicApi } from '../../api/public.api';

const mockGetVehicle = vi.mocked(publicApi.getVehicle);

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWithProviders(
  ui: React.ReactElement,
  { orgId = 'org-1', vehicleId = 'veh-1' } = {},
) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/public/${orgId}/vehicles/${vehicleId}`]}>
        <Routes>
          <Route path="/public/:orgId/vehicles/:vehicleId" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const baseMockVehicle: PublicVehicleResponse = {
  identifier: 'TEST-001',
  brand: 'Toyota',
  model: 'Hilux',
  year: 2020,
  status: { name: 'Активний' },
  publicSummary: 'Тестовий автомобіль',
  publicCollectedAmountUahMinor: 10000000,
  publicGoalAmountUahMinor: 50000000,
  galleries: [],
  createdAt: '2024-01-01T00:00:00Z',
};

describe('PublicVehiclePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders vehicle info without galleries', async () => {
    mockGetVehicle.mockResolvedValue({
      ...baseMockVehicle,
      galleries: [],
    });

    renderWithProviders(<PublicVehiclePage />);

    expect(await screen.findByText('Toyota Hilux')).toBeInTheDocument();
    expect(screen.getAllByText('TEST-001')).toHaveLength(2);
    expect(screen.getByText('Фото ще не додано')).toBeInTheDocument();
  });

  it('renders main gallery with Основна label', async () => {
    mockGetVehicle.mockResolvedValue({
      ...baseMockVehicle,
      galleries: [
        {
          id: 'gal-main',
          kind: 'main',
          name: null,
          displayLabel: 'Основна',
          description: null,
          sortOrder: 0,
          coverItemId: null,
          items: [
            { id: 'item-1', type: 'image', mimeType: 'image/jpeg', caption: null, sortOrder: 0 },
            {
              id: 'item-2',
              type: 'image',
              mimeType: 'image/jpeg',
              caption: 'Photo 2',
              sortOrder: 1,
            },
          ],
        },
      ],
    });

    renderWithProviders(<PublicVehiclePage />);

    expect(await screen.findByText('Основна')).toBeInTheDocument();
    expect(screen.getAllByAltText(/Основна|Photo 2/)).toHaveLength(2);
  });

  it('renders custom public gallery with custom name and description', async () => {
    mockGetVehicle.mockResolvedValue({
      ...baseMockVehicle,
      galleries: [
        {
          id: 'gal-custom',
          kind: 'custom',
          name: 'Додаткові фото',
          displayLabel: 'Додаткові фото',
          description: 'Фото з ремонту та обслуговування',
          sortOrder: 1,
          coverItemId: null,
          items: [
            { id: 'item-3', type: 'image', mimeType: 'image/jpeg', caption: null, sortOrder: 0 },
          ],
        },
      ],
    });

    renderWithProviders(<PublicVehiclePage />);

    expect(await screen.findByText('Додаткові фото')).toBeInTheDocument();
    expect(screen.getByText('Фото з ремонту та обслуговування')).toBeInTheDocument();
  });

  it('does not render empty gallery sections', async () => {
    mockGetVehicle.mockResolvedValue({
      ...baseMockVehicle,
      galleries: [
        {
          id: 'gal-empty',
          kind: 'custom',
          name: 'Пуста галерея',
          displayLabel: 'Пуста галерея',
          description: 'Ця галерея порожня',
          sortOrder: 0,
          coverItemId: null,
          items: [],
        },
        {
          id: 'gal-main',
          kind: 'main',
          name: null,
          displayLabel: 'Основна',
          description: null,
          sortOrder: 1,
          coverItemId: null,
          items: [
            { id: 'item-1', type: 'image', mimeType: 'image/jpeg', caption: null, sortOrder: 0 },
          ],
        },
      ],
    });

    renderWithProviders(<PublicVehiclePage />);

    expect(await screen.findByText('Основна')).toBeInTheDocument();
    expect(screen.queryByText('Пуста галерея')).not.toBeInTheDocument();
    expect(screen.queryByText('Ця галерея порожня')).not.toBeInTheDocument();
  });

  it('renders multiple galleries in sortOrder', async () => {
    mockGetVehicle.mockResolvedValue({
      ...baseMockVehicle,
      galleries: [
        {
          id: 'gal-second',
          kind: 'custom',
          name: 'Друга галерея',
          displayLabel: 'Друга галерея',
          description: null,
          sortOrder: 2,
          coverItemId: null,
          items: [
            { id: 'item-2', type: 'image', mimeType: 'image/jpeg', caption: null, sortOrder: 0 },
          ],
        },
        {
          id: 'gal-main',
          kind: 'main',
          name: null,
          displayLabel: 'Основна',
          description: null,
          sortOrder: 0,
          coverItemId: null,
          items: [
            { id: 'item-1', type: 'image', mimeType: 'image/jpeg', caption: null, sortOrder: 0 },
          ],
        },
        {
          id: 'gal-first',
          kind: 'custom',
          name: 'Перша галерея',
          displayLabel: 'Перша галерея',
          description: null,
          sortOrder: 1,
          coverItemId: null,
          items: [
            { id: 'item-3', type: 'image', mimeType: 'image/jpeg', caption: null, sortOrder: 0 },
          ],
        },
      ],
    });

    renderWithProviders(<PublicVehiclePage />);

    const headings = await screen.findAllByRole('heading', { level: 4 });
    expect(headings[0]).toHaveTextContent('Основна');
    expect(headings[1]).toHaveTextContent('Перша галерея');
    expect(headings[2]).toHaveTextContent('Друга галерея');
  });

  it('renders 404 result when vehicle not found', async () => {
    mockGetVehicle.mockRejectedValue(new Error('Not found'));

    renderWithProviders(<PublicVehiclePage />);

    expect(await screen.findByText('Сторінка не знайдена або недоступна')).toBeInTheDocument();
  });
});
