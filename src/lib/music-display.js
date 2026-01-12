const getMusicDisplayName = (music, options = {}) => {
    const alias = music?.alias?.trim();
    if (alias) {
        return alias;
    }

    const shortId = music?.id?.slice(0, 8) ?? "";
    if (options.prefix) {
        return shortId ? `${options.prefix} ${shortId}` : options.prefix;
    }

    return shortId;
};

module.exports = { getMusicDisplayName };
