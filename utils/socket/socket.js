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

        // ================= ✅ NEW: JOIN ORDER =================
        socket.on("join_order", (orderId) => {

            if (!orderId) {
                console.log("❌ Invalid orderId");
                return;
            }

            socket.join(orderId.toString());

            console.log(`🚗 Socket ${socket.id} joined order ${orderId}`);
        });

        // ================= JOIN CUSTOMER =================
        socket.on("join_customer", (customerId) => {

            if (!customerId) {
                console.log("❌ Invalid customerId");
                return;
            }

            socket.join(customerId.toString());

            console.log(`👤 Socket ${socket.id} joined customer ${customerId}`);
        });

        // ================= ✅ NEW: MECHANIC LOCATION UPDATE =================
        socket.on("mechanic_location_update", async (data) => {

            try {
                const { orderId, mechanicId, latitude, longitude } = data;

                if (!orderId || !latitude || !longitude) {
                    console.log("❌ Invalid location payload");
                    return;
                }

                console.log("📡 Location update:", data);

                // 🔥 Update DB (ServiceRequest)
                const ServiceRequest = require("../../models/ServiceRequest");

                await ServiceRequest.findByIdAndUpdate(orderId, {
                    mechanicLocation: {
                        location: {
                            type: "Point",
                            coordinates: [longitude, latitude]
                        }
                    }
                });

                // 🔥 Emit to all users in this order room
                io.to(orderId.toString()).emit("location_update", {
                    mechanicId,
                    latitude,
                    longitude
                });

            } catch (err) {
                console.error("❌ Error updating location:", err.message);
            }
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

// ================= ✅ NEW EMIT HELPER =================

// 📍 Emit mechanic location manually (optional use)
const emitMechanicLocation = (orderId, data) => {

    if (!orderId) return;

    console.log("📡 Emitting live location to order:", orderId);

    getIO().to(orderId.toString()).emit("location_update", data);
};

const emitOrderStatusUpdate = (orderId, data) => {
    if (!orderId) return;

    console.log("📢 Emitting order status update:", orderId);

    getIO().to(orderId.toString()).emit("order_status_update", data);
};

const emitSOSAccepted = (customerId, data) => {

    if (!customerId) return;

    const roomId = customerId.toString();

    console.log("🚨 Emitting SOS accepted to customer:", roomId);

    getIO().to(roomId).emit("sos_accepted", data);
};

module.exports = {
    initSocket,
    emitNewRequest,
    emitRemoveRequest,
    emitSOSAccepted,
    emitMechanicLocation,
    emitOrderStatusUpdate // ✅ new export
};

