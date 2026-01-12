let lastPayload = null;

const setDragPayload = (payload) => {
    lastPayload = payload ?? null;
};

const getDragPayload = () => lastPayload;

const clearDragPayload = () => {
    lastPayload = null;
};

module.exports = { setDragPayload, getDragPayload, clearDragPayload };
