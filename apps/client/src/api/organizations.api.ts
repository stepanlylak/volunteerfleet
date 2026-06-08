import type {
  AddMemberByEmail,
  OrganizationCreate,
  OrganizationListQuery,
  OrganizationListResponse,
  OrganizationMemberResponse,
  OrganizationMemberUpdate,
  OrganizationResponse,
  OrganizationUpdate,
  OrganizationWithMembersResponse,
} from '@volunteerfleet/shared';
import { http } from './client';

export const organizationsApi = {
  async list(params: Partial<OrganizationListQuery>): Promise<OrganizationListResponse> {
    const res = await http.get<OrganizationListResponse>('/organizations', { params });
    return res.data;
  },

  async create(payload: OrganizationCreate): Promise<OrganizationResponse> {
    const res = await http.post<OrganizationResponse>('/organizations', payload);
    return res.data;
  },

  async getById(id: string): Promise<OrganizationWithMembersResponse> {
    const res = await http.get<OrganizationWithMembersResponse>(`/organizations/${id}`);
    return res.data;
  },

  async update(id: string, payload: OrganizationUpdate): Promise<OrganizationResponse> {
    const res = await http.patch<OrganizationResponse>(`/organizations/${id}`, payload);
    return res.data;
  },

  async addMember(id: string, payload: AddMemberByEmail): Promise<void> {
    await http.post(`/organizations/${id}/members`, payload);
  },

  async updateMemberRole(
    id: string,
    userId: string,
    payload: OrganizationMemberUpdate,
  ): Promise<void> {
    await http.patch(`/organizations/${id}/members/${userId}`, payload);
  },

  async removeMember(id: string, userId: string): Promise<void> {
    await http.delete(`/organizations/${id}/members/${userId}`);
  },
};

export const myOrganizationApi = {
  async get(): Promise<OrganizationWithMembersResponse> {
    const res = await http.get<OrganizationWithMembersResponse>('/my-organization');
    return res.data;
  },

  async update(payload: OrganizationUpdate): Promise<OrganizationResponse> {
    const res = await http.patch<OrganizationResponse>('/my-organization', payload);
    return res.data;
  },

  async listMembers(): Promise<OrganizationMemberResponse[]> {
    const res = await http.get<OrganizationMemberResponse[]>('/my-organization/members');
    return res.data;
  },

  async addMember(payload: AddMemberByEmail): Promise<void> {
    await http.post('/my-organization/members', payload);
  },

  async updateMemberRole(userId: string, payload: OrganizationMemberUpdate): Promise<void> {
    await http.patch(`/my-organization/members/${userId}`, payload);
  },

  async removeMember(userId: string): Promise<void> {
    await http.delete(`/my-organization/members/${userId}`);
  },
};
