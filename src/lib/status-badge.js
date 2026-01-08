const getStatusBadgeVariant = (status) => {
    if (status === "IDLE") {
        return "default";
    }
    if (status === "FAILED") {
        return "destructive";
    }
    return "secondary";
};

module.exports = { getStatusBadgeVariant };
