const buildCreateMusicRequest = (alias) => {
    const trimmed = alias?.trim();
    if (!trimmed) {
        return undefined;
    }

    return { alias: trimmed };
};

module.exports = { buildCreateMusicRequest };
