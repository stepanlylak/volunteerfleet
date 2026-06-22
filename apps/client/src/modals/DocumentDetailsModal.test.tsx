import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DocumentResponse } from '@volunteerfleet/shared';
import { DocumentDetailsModal } from './DocumentDetailsModal';

vi.mock('../api/documents.api', () => ({
  documentsApi: {
    getDownloadUrl: vi.fn(
      (id: string, _cacheKey?: string, disposition?: 'inline' | 'attachment') =>
        `/api/v1/documents/${id}/download?disposition=${disposition ?? 'attachment'}`,
    ),
  },
}));

vi.mock('../hooks/useDocuments', () => ({
  useDocument: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

function createDocument(overrides: Partial<DocumentResponse> = {}): DocumentResponse {
  return {
    id: 'doc-1',
    name: 'test.pdf',
    kind: 'upload',
    fileKey: null,
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    vehicleId: null,
    vehicle: null,
    groupId: null,
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

function renderModal(props: {
  documents?: DocumentResponse[];
  open?: boolean;
  initialIndex?: number;
}) {
  return render(
    <DocumentDetailsModal
      open={props.open ?? true}
      documents={props.documents}
      onClose={vi.fn()}
      initialIndex={props.initialIndex ?? 0}
    />,
  );
}

describe('DocumentDetailsModal', () => {
  it('renders PDF in iframe', () => {
    renderModal({ documents: [createDocument()] });

    const iframe = screen.getByTitle('test.pdf');
    expect(iframe).toBeTruthy();
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe.getAttribute('src')).toBe('/api/v1/documents/doc-1/download?disposition=inline');
  });

  it('renders fallback for unknown file type', () => {
    renderModal({
      documents: [
        createDocument({
          id: 'doc-2',
          name: 'report.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      ],
    });

    expect(screen.getByText('Перегляд недоступний')).toBeTruthy();
    expect(screen.getByText('report.docx')).toBeTruthy();
  });

  it('renders image preview group', () => {
    renderModal({
      documents: [createDocument({ id: 'doc-3', name: 'photo.jpg', mimeType: 'image/jpeg' })],
    });

    expect(screen.getByAltText('photo.jpg')).toBeTruthy();
  });

  it('renders external link document', () => {
    renderModal({
      documents: [
        createDocument({ id: 'doc-4', name: 'Link', kind: 'link', url: 'https://example.com' }),
      ],
    });

    expect(screen.getByText('Зовнішнє посилання')).toBeTruthy();
    expect(screen.getByText('https://example.com')).toBeTruthy();
  });

  it('navigates between group documents', () => {
    renderModal({
      documents: [
        createDocument({ id: 'doc-5', name: 'first.pdf' }),
        createDocument({ id: 'doc-6', name: 'second.jpg', mimeType: 'image/jpeg' }),
        createDocument({
          id: 'doc-7',
          name: 'third.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      ],
    });

    expect(screen.getByText('Документи')).toBeTruthy();
    expect(screen.getByText('(1 / 3)')).toBeTruthy();
    expect(screen.getByTitle('first.pdf')).toBeTruthy();

    fireEvent.click(screen.getByText('Наступний'));

    expect(screen.getByText('(2 / 3)')).toBeTruthy();
    expect(screen.getByAltText('second.jpg')).toBeTruthy();
  });

  it('toggles fullscreen mode', () => {
    renderModal({ documents: [createDocument()] });

    const fullscreenButton = screen.getByText('Повноекранний режим');
    fireEvent.click(fullscreenButton);

    expect(screen.getByText('Вийти з повноекрану')).toBeTruthy();
  });
});
