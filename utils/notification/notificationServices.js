const Shop = require("../../models/Shop");
const Mechanic = require("../../models/Mechanic");
const sendFCM = require("./sendFCM");

const sendNotificationToShop = async (shopId, message) => {
    try {

        // Get shop
        const shop = await Shop.findById(shopId);

        if (!shop) {
            console.log("Shop not found");
            return;
        }

        // Combine owner + workers
        const mechanicIds = [
            shop.ownerId,
            ...shop.workers
        ];

        // Fetch only fcmToken
        const mechanics = await Mechanic.find(
            { _id: { $in: mechanicIds } },
            { fcmToken: 1 }
        );

        // Extract valid tokens
        let tokens = mechanics
            .map(m => m.fcmToken)
            .filter(token => token);

        // Remove duplicates
        tokens = [...new Set(tokens)];

        if (tokens.length === 0) {
            console.log("No valid FCM tokens found");
            return;
        }

        console.log("Sending notification to tokens:", tokens);

        // Send notification
        await sendFCM(tokens, message);

    } catch (error) {
        console.error("Error in sendNotificationToShop:", error);
    }
};

module.exports = {
    sendNotificationToShop
};