const admin = require("firebase-admin");
// const serviceAccount = require("../../credentials/trego-app-firebase-adminsdk-fbsvc-e8291acaf1.json");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;