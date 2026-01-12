const buildProjectUpdateRequest = (title) => {
    const trimmed = title?.trim();
    if (!trimmed) {
        return null;
    }

    return { title: trimmed };
};

module.exports = { buildProjectUpdateRequest };
