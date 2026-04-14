const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true
        },
        vehicleType: {
            type: String,
            enum: ["bicycle", "scooter", "bike", "car", "heavy"],
            required: true
        },
        vehicleBrand: {
            type: String,
            required: true
        },
        vehicleModel: {
            type: String,
            required: true
        },
        registrationNumber: {
            type: String
        }
    }
);

module.exports = mongoose.model("Vehicle", vehicleSchema);
