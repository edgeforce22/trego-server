const mongoose = require("mongoose");

const mechanicSchema = new mongoose.Schema(
    {
        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Shop",
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        phoneNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        role: {
            type: String,
            enum: ["owner", "worker"],
            required: true
        },
        address: {
            type: String,
            required: true,
            trim: true
        },
        location: {
            type: {
                type: String,
                enum: ["Point"],
                required: true
            },
            coordinates: {
                type: [Number],
                required: true
            }
        },
        password: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "inactive",
        },
        fcmToken: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

mechanicSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Mechanic", mechanicSchema);
