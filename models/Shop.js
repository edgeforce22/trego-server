const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Mechanic",
            required: true
        },
        shopImage: {
            type: String,
            default: ""
        },
        shopName: {
            type: String,
            required: true
        },
        phoneNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "inactive",
        },
        rating: {
            type: Number,
            default: 0
        },

        ratingCount: {
            type: Number,
            default: 0
        },

        ratingSum: {
            type: Number,
            default: 0
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
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "inactive",
        },
        openingTime: {
            type: String,
            required: true
        },
        closingTime: {
            type: String,
            required: true
        },
        supportedVehicles: [
            {
                type: String
            }
        ],
        fcmToken: {
            type: String,
            default: null
        },
        workers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Mechanic"
            }
        ],
    },
    {
        timestamps: true
    }
);

shopSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Shop", shopSchema);
