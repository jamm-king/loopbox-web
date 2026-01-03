export interface Project {
    id: string;
    title: string;
    status: string;
}

export interface CreateProjectRequest {
    title: string;
}

export interface CreateProjectResponse {
    project: Project;
}

export interface GetProjectResponse {
    project: Project;
}

export interface GetAllProjectResponse {
    projectList: Project[];
}

export interface MusicConfig {
    mood?: string;
    bpm?: number;
    melody?: string;
    harmony?: string;
    bass?: string;
    beat?: string;
}

export interface MusicVersion {
    id: string;
    config: MusicConfig;
    fileId?: string;
    durationSeconds?: number;
}

export interface Music {
    id: string;
    status: string;
}

export interface CreateMusicResponse {
    music: Music;
}

export interface GetMusicResponse {
    music: Music;
    versions: MusicVersion[];
}

export interface GetMusicListResponse {
    musicList: Music[];
}

export interface GenerateVersionRequest {
    provider: string;
    mood?: string;
    bpm?: number;
    melody?: string;
    harmony?: string;
    bass?: string;
    beat?: string;
}

export interface GenerateVersionResponse {
    music: Music;
}

export interface DeleteVersionResponse {
    music: Music;
}
