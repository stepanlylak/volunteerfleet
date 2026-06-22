import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DocumentResponse, DocumentGroupResponse } from '@volunteerfleet/shared';
import { StatusHistoryGroupLinks } from './StatusHistoryGroupLinks';

vi.mock('../../hooks/useDocumentGroups', () => ({
  useDocumentGroup: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

vi.mock('../../modals/DocumentDetailsModal', () => ({
  DocumentDetailsModal: vi.fn(
    ({ open, documents }: { open: boolean; documents: DocumentResponse[] }) =>
      open ? <div data-testid="preview-modal">{documents.length} documents</div> : null,
  ),
}));

import { useDocumentGroup } from '../../hooks/useDocumentGroups';

const mockUseDocumentGroup = vi.mocked(useDocumentGroup);

function createDocument(overrides: Partial<DocumentResponse> = {}): DocumentResponse {
  return {
    id: 'doc-1',
    name: 'report.pdf',
    kind: 'upload',
    fileKey: null,
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    vehicleId: null,
    vehicle: null,
    groupId: 'group-1',
    group: null,
    createdBy: { id: 'user-1', fullName: 'Test User' },
    updatedBy: { id: 'user-1', fullName: 'Test User' },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    url: null,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

describe('StatusHistoryGroupLinks', () => {
  it('opens the preview modal when clicked', () => {
    const group: DocumentGroupResponse = {
      id: 'group-1',
      name: 'Documents',
      vehicleId: 'veh-1',
      expenseIds: [],
      donationIds: [],
      documents: [createDocument()],
      createdBy: { id: 'user-1', fullName: 'Test User' },
      updatedBy: { id: 'user-1', fullName: 'Test User' },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
    mockUseDocumentGroup.mockReturnValue({ data: group, isLoading: false } as ReturnType<
      typeof useDocumentGroup
    >);

    render(<StatusHistoryGroupLinks label="Docs" groupId="group-1" />);

    fireEvent.click(screen.getByText(/Docs/));

    expect(screen.getByTestId('preview-modal')).toHaveTextContent('1 documents');
  });
});
