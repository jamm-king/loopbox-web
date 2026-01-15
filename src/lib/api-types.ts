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

export interface UpdateProjectRequest {
    title: string;
}

export interface UpdateProjectResponse {
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
    alias?: string | null;
    status: string;
}

export interface CreateMusicResponse {
    music: Music;
}

export interface CreateMusicRequest {
    alias?: string | null;
}

export interface UpdateMusicRequest {
    alias?: string | null;
}

export interface UpdateMusicResponse {
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

export interface ImageConfig {
    description?: string;
    width?: number;
    height?: number;
}

export interface ImageVersion {
    id: string;
    fileId?: string;
    url?: string;
    config: ImageConfig;
}

export interface Image {
    id: string;
    status: string;
}

export interface CreateImageResponse {
    image: Image;
}

export interface GetImageResponse {
    image: Image;
    versions: ImageVersion[];
}

export interface GetImageListResponse {
    images: Image[];
}

export interface GenerateImageVersionRequest {
    provider: string;
    description?: string;
    width?: number;
    height?: number;
}

export interface GenerateImageVersionResponse {
    image: Image;
}

export interface DeleteImageVersionResponse {
    image: Image;
}

export interface VideoSegment {
    id: string;
    musicVersionId: string;
    musicId: string;
    durationSeconds: number;
    order: number;
}

export interface VideoImageGroup {
    id: string;
    imageVersionId: string;
    imageId: string;
    segmentIndexStart: number;
    segmentIndexEnd: number;
}

export interface Video {
    id: string;
    projectId: string;
    status: string;
    totalDurationSeconds: number;
    fileId?: string;
    segments: VideoSegment[];
    imageGroups: VideoImageGroup[];
}

export interface GetVideoResponse {
    video: Video;
}

export interface UpdateVideoRequest {
    segments: Array<{ musicVersionId: string }>;
    imageGroups: Array<{
        imageVersionId: string;
        segmentIndexStart: number;
        segmentIndexEnd: number;
    }>;
}

export interface UpdateVideoResponse {
    video: Video;
}

export interface RenderVideoResponse {
    video: Video;
}
