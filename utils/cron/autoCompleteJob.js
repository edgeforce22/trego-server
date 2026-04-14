// cron/autoCompleteJob.js
const cron = require("node-cron");
const ServiceRequest = require("../../models/ServiceRequest");
const admin = require("../firebase/firebase");

const startAutoCompleteJob = () => {

    cron.schedule("*/10 * * * *", async () => {
        console.log("Running auto-complete job every 10 minutes...");

        try {
            const now = new Date();

            const expiredRequests = await ServiceRequest.find({
                status: "waiting_for_confirmation",
                autoCompleteAt: { $lte: now }
            })
                .populate("customerId")
                .populate("mechanicId");

            for (const request of expiredRequests) {

                // Extra safety check
                if (request.status !== "waiting_for_confirmation") continue;

                // Update status + cleanup
                request.status = "completed";
                request.autoCompleteAt = null;
                request.completionRequestedAt = null;

                await request.save();

                console.log("Auto-completed:", request._id);

                try {

                    const customer = request.customerId;
                    const mechanic = request.mechanicId;

                    const dataPayload = {
                        serviceId: request._id.toString(),
                        requestStatus: request.status,
                        type: "SERVICE_COMPLETED"
                    };

                    const notifications = [];

                    // Customer Notification
                    if (customer?.fcmToken) {
                        notifications.push(
                            admin.messaging().send({
                                token: customer.fcmToken,
                                notification: {
                                    title: "Service Completed",
                                    body: "Your service request has been auto-completed"
                                },
                                data: dataPayload
                            })
                        );
                    }

                    // Mechanic Notification
                    if (mechanic?.fcmToken) {
                        notifications.push(
                            admin.messaging().send({
                                token: mechanic.fcmToken,
                                notification: {
                                    title: "Service Completed",
                                    body: "Service marked as completed"
                                },
                                data: dataPayload
                            })
                        );
                    }

                    // Run in parallel (FAST)
                    await Promise.all(notifications);

                    if (notifications.length > 0) {
                        console.log("Notifications sent");
                    }

                } catch (notifyErr) {
                    console.error("Notification error:", notifyErr);
                }
            }

        } catch (err) {
            console.error("Cron error:", err);
        }
    });

};

module.exports = startAutoCompleteJob;