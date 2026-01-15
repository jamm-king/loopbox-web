import axios from 'axios';
import {
    CreateImageResponse,
    CreateMusicRequest,
    CreateMusicResponse,
    CreateProjectRequest,
    CreateProjectResponse,
    DeleteImageVersionResponse,
    DeleteVersionResponse,
    GenerateImageVersionRequest,
    GenerateImageVersionResponse,
    GenerateVersionRequest,
    GenerateVersionResponse,
    GetAllProjectResponse,
    GetImageListResponse,
    GetImageResponse,
    GetMusicListResponse,
    GetMusicResponse,
    GetProjectResponse,
    GetVideoResponse,
    UpdateProjectRequest,
    UpdateProjectResponse,
    UpdateMusicRequest,
    UpdateMusicResponse,
    UpdateVideoRequest,
    UpdateVideoResponse,
    RenderVideoResponse,
    SignupRequest,
    SignupResponse,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RefreshResponse,
    LogoutRequest,
} from './api-types';
import { buildVideoFileUrl } from './video-file-url';
import { clearAuthState, getAccessToken } from './auth';

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

api.interceptors.request.use((config) => {
    const accessToken = getAccessToken();
    if (accessToken) {
        config.headers = {
            ...config.headers,
            Authorization: `Bearer ${accessToken}`,
        };
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401) {
            clearAuthState();
        }
        return Promise.reject(error);
    }
);

const requireAccessToken = () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error("User not authenticated");
    }
    return accessToken;
};

export const projectApi = {
    create: async (data: CreateProjectRequest): Promise<CreateProjectResponse> => {
        const response = await api.post('/project', data);
        return response.data;
    },
    update: async (projectId: string, data: UpdateProjectRequest): Promise<UpdateProjectResponse> => {
        const response = await api.patch(`/project/${projectId}`, data);
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
    create: async (projectId: string, data?: CreateMusicRequest): Promise<CreateMusicResponse> => {
        const response = await api.post(
            `/project/${projectId}/music/create`,
            data
        );
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
    update: async (
        projectId: string,
        musicId: string,
        data: UpdateMusicRequest
    ): Promise<UpdateMusicResponse> => {
        const response = await api.patch(`/project/${projectId}/music/${musicId}`, data);
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
        const response = await api.delete(`/project/${projectId}/music/${musicId}/version/${versionId}`);
        return response.data;
    },
    getAudioUrl: (musicId: string, versionId: string): string => {
        const accessToken = requireAccessToken();
        const params = new URLSearchParams({ accessToken });
        return `${API_BASE_URL}/music/${musicId}/versions/${versionId}/audio?${params.toString()}`;
    },
};

export const imageApi = {
    create: async (projectId: string): Promise<CreateImageResponse> => {
        const response = await api.post(
            `/project/${projectId}/image/create`,
            undefined
        );
        return response.data;
    },
    get: async (projectId: string, imageId: string): Promise<GetImageResponse> => {
        const response = await api.get(`/project/${projectId}/image/${imageId}`);
        return response.data;
    },
    getList: async (projectId: string): Promise<GetImageListResponse> => {
        const response = await api.get(`/project/${projectId}/image`);
        return response.data;
    },
    delete: async (projectId: string, imageId: string): Promise<void> => {
        await api.delete(`/project/${projectId}/image/${imageId}`);
    },
    generateVersion: async (
        projectId: string,
        imageId: string,
        data: GenerateImageVersionRequest
    ): Promise<GenerateImageVersionResponse> => {
        const response = await api.post(
            `/project/${projectId}/image/${imageId}/version/generate`,
            data
        );
        return response.data;
    },
    deleteVersion: async (
        projectId: string,
        imageId: string,
        versionId: string
    ): Promise<DeleteImageVersionResponse> => {
        const response = await api.delete(`/project/${projectId}/image/${imageId}/version/${versionId}`);
        return response.data;
    },
};

export const videoApi = {
    get: async (projectId: string): Promise<GetVideoResponse> => {
        const response = await api.get(`/project/${projectId}/video`);
        return response.data;
    },
    update: async (projectId: string, data: UpdateVideoRequest): Promise<UpdateVideoResponse> => {
        const response = await api.put(`/project/${projectId}/video`, data);
        return response.data;
    },
    render: async (projectId: string): Promise<RenderVideoResponse> => {
        const response = await api.post(`/project/${projectId}/video/render`);
        return response.data;
    },
    getFileUrl: (projectId: string, fileId?: string): string => {
        return buildVideoFileUrl(API_BASE_URL, projectId, fileId, requireAccessToken());
    },
};

export const authApi = {
    signup: async (data: SignupRequest): Promise<SignupResponse> => {
        const response = await api.post("/auth/signup", data);
        return response.data;
    },
    login: async (data: LoginRequest): Promise<LoginResponse> => {
        const response = await api.post("/auth/login", data);
        return response.data;
    },
    refresh: async (data: RefreshRequest): Promise<RefreshResponse> => {
        const response = await api.post("/auth/refresh", data);
        return response.data;
    },
    logout: async (data: LogoutRequest): Promise<void> => {
        await api.post("/auth/logout", data);
    },
};
