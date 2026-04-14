const admin = require("../firebase/firebase");

const sendFCM = async (tokens, message) => {
    try {

        if (!tokens || tokens.length === 0) {
            console.log("No FCM tokens provided");
            return;
        }

        const payload = {
            notification: {
                title: message.title || "Notification",
                body: message.body || "",
            },
            data: message.data || {}, // optional custom data
        };

        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            ...payload,
        });

        console.log(`Notifications sent: ${response.successCount}`);
        console.log(`Notifications failed: ${response.failureCount}`);

        // Handle invalid tokens (VERY IMPORTANT)
        const invalidTokens = [];

        response.responses.forEach((res, index) => {
            if (!res.success) {
                const errorCode = res.error?.code;

                if (
                    errorCode === "messaging/invalid-registration-token" ||
                    errorCode === "messaging/registration-token-not-registered"
                ) {
                    invalidTokens.push(tokens[index]);
                }
            }
        });

        if (invalidTokens.length > 0) {
            console.log("Invalid tokens:", invalidTokens);

            // Optional: remove from DB
            // await Mechanic.updateMany(
            //   { fcmToken: { $in: invalidTokens } },
            //   { $set: { fcmToken: null } }
            // );
        }

        return response;

    } catch (error) {
        console.error("Error sending FCM:", error);
        throw error;
    }
};

module.exports = sendFCM;