const buildVideoFileUrl = (apiBaseUrl, projectId, fileId, accessToken) => {
    const params = new URLSearchParams();
    if (fileId) params.set("v", fileId);
    if (accessToken) params.set("accessToken", accessToken);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return `${apiBaseUrl}/project/${projectId}/video/file${suffix}`;
};

module.exports = {
    buildVideoFileUrl,
};
