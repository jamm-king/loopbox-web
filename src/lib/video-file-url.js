const buildVideoFileUrl = (apiBaseUrl, projectId, fileId, userId) => {
    const params = new URLSearchParams();
    if (fileId) params.set("v", fileId);
    if (userId) params.set("userId", userId);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return `${apiBaseUrl}/project/${projectId}/video/file${suffix}`;
};

module.exports = {
    buildVideoFileUrl,
};
