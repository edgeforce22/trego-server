
let io;

// ================= INIT =================
const initSocket = (server) => {

    const { Server } = require("socket.io");

    io = new Server(server, {
        cors: { origin: "*" }
    });

    io.on("connection", (socket) => {

        console.log("🔌 Socket connected:", socket.id);

        // ================= JOIN SHOP =================
        socket.on("join_shop", (shopId) => {

            if (!shopId) {
                console.log("❌ Invalid shopId");
                return;
            }

            socket.join(shopId.toString());

            console.log(`📍 Socket ${socket.id} joined shop ${shopId}`);
        });

        // ================= DISCONNECT =================
        socket.on("disconnect", () => {
            console.log("❌ Socket disconnected:", socket.id);
        });

    });
};

// ================= GET IO SAFELY =================
const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

// ================= EMIT HELPERS =================

// 🔔 New Request
const emitNewRequest = (shopId, data) => {

    if (!shopId) return;

    console.log("📢 Emitting new_request to shop:", shopId);

    getIO().to(shopId.toString()).emit("new_request", data);
};

// ❌ Remove Request (accept/cancel)
const emitRemoveRequest = (shopId, requestId) => {

    if (!shopId || !requestId) return;

    console.log("📢 Emitting request_removed:", requestId);

    getIO().to(shopId.toString()).emit("request_removed", {
        requestId
    });
};

module.exports = {
    initSocket,
    emitNewRequest,
    emitRemoveRequest
};