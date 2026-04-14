class ApiResponse {
    constructor(success, message, data = null, error = null) {
        this.success = success;
        this.message = message;
        this.data = data;
        this.error = error;
    }

    static success(message, data) {
        return new ApiResponse(true, message, data);
    }

    static error(message, code = 500, details = null) {
        return new ApiResponse(false, message, null, {
            code,
            details
        });
    }
}

module.exports = ApiResponse;