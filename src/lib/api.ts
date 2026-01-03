import axios from 'axios';
import {
    CreateMusicResponse,
    CreateProjectRequest,
    CreateProjectResponse,
    DeleteVersionResponse,
    GenerateVersionRequest,
    GenerateVersionResponse,
    GetAllProjectResponse,
    GetMusicListResponse,
    GetMusicResponse,
    GetProjectResponse,
} from './api-types';

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8080';

const API_BASE_URL = typeof window === 'undefined'
    ? `${backendUrl}/api`
    : '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const projectApi = {
    create: async (data: CreateProjectRequest): Promise<CreateProjectResponse> => {
        const response = await api.post('/project', data);
        return response.data;
    },
    get: async (projectId: string): Promise<GetProjectResponse> => {
        const response = await api.get(`/project/${projectId}`);
        return response.data;
    },
    getAll: async (): Promise<GetAllProjectResponse> => {
        const response = await api.get('/project');
        return response.data;
    },
    delete: async (projectId: string): Promise<void> => {
        await api.delete(`/project/${projectId}`);
    },
};

export const musicApi = {
    create: async (projectId: string): Promise<CreateMusicResponse> => {
        const response = await api.post(`/project/${projectId}/music/create`);
        return response.data;
    },
    get: async (projectId: string, musicId: string): Promise<GetMusicResponse> => {
        const response = await api.get(`/project/${projectId}/music/${musicId}`);
        return response.data;
    },
    getList: async (projectId: string): Promise<GetMusicListResponse> => {
        const response = await api.get(`/project/${projectId}/music`);
        return response.data;
    },
    delete: async (projectId: string, musicId: string): Promise<void> => {
        await api.delete(`/project/${projectId}/music/${musicId}`);
    },
    generateVersion: async (
        projectId: string,
        musicId: string,
        data: GenerateVersionRequest
    ): Promise<GenerateVersionResponse> => {
        const response = await api.post(
            `/project/${projectId}/music/${musicId}/version/generate`,
            data
        );
        return response.data;
    },
    deleteVersion: async (
        projectId: string,
        musicId: string,
        versionId: string
    ): Promise<DeleteVersionResponse> => {
        const response = await api.delete(
            `/project/${projectId}/music/${musicId}/version/${versionId}`
        );
        return response.data;
    },
    getAudioUrl: (musicId: string, versionId: string): string => {
        return `${API_BASE_URL}/music/${musicId}/versions/${versionId}/audio`;
    },
};
