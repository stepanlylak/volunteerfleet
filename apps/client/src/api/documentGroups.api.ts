import type {
  DocumentGroupCreate,
  DocumentGroupResponse,
  DocumentGroupUpdate,
} from '@volunteerfleet/shared';
import { http } from './client';

export const documentGroupsApi = {
  async create(payload: DocumentGroupCreate): Promise<DocumentGroupResponse> {
    const res = await http.post<DocumentGroupResponse>('/document-groups', payload);
    return res.data;
  },

  async getById(id: string): Promise<DocumentGroupResponse> {
    const res = await http.get<DocumentGroupResponse>(`/document-groups/${id}`);
    return res.data;
  },

  async update(id: string, payload: DocumentGroupUpdate): Promise<DocumentGroupResponse> {
    const res = await http.patch<DocumentGroupResponse>(`/document-groups/${id}`, payload);
    return res.data;
  },

  async moveDocument(groupId: string, documentId: string): Promise<DocumentGroupResponse> {
    const res = await http.post<DocumentGroupResponse>(
      `/document-groups/${groupId}/documents/${documentId}`,
    );
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/document-groups/${id}`);
  },
};
