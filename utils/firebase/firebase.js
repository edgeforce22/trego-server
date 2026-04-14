const admin = require("firebase-admin");
const serviceAccount = require("../../credentials/trego-app-firebase-adminsdk-fbsvc-e8291acaf1.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;