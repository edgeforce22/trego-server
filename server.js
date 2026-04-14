// Trego Server

// Variable Declaration
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const startAutoCompleteJob = require("./utils/cron/autoCompleteJob");
const http = require("http");
const { initSocket } = require("./utils/socket/socket");

// Server Creation
dotenv.config();

const app = express();
const server = http.createServer(app);

const corsOptions = {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Initialize Socket.IO
initSocket(server);

// Port Initialization
const PORT = process.env.PORT || 5000;

// MongoDB Connection
const MONGODB_URL = process.env.MONGODB_URL;
mongoose
    .connect(MONGODB_URL)
    .then(() => {
        console.log("MongoDB Connected");

        // Util functions
        startAutoCompleteJob();
    })
    .catch((err) => console.error("MongoDB Connection Error :", err));

// Request routing
const customerAuth = require("./routes/customer/auth")
const mechanicAuth = require("./routes/mechanic/auth")

// APIs
app.use("/api/customer/auth", customerAuth);
app.use("/api/mechanic/auth", mechanicAuth);

// Server listening
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});