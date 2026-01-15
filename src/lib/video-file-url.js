const buildVideoFileUrl = (apiBaseUrl, projectId, fileId) => {
    const suffix = fileId ? `?v=${fileId}` : "";
    return `${apiBaseUrl}/project/${projectId}/video/file${suffix}`;
};

module.exports = {
    buildVideoFileUrl,
};
