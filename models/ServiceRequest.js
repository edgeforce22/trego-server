const mongoose = require("mongoose");

const serviceRequestSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true
        },

        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Shop"
        },

        mechanicId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Mechanic"
        },

        vehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle"
        },

        serviceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Services"
        },

        problemDescription: {
            type: String,
            required: true
        },

        // Customer Location
        customerLocation: {
            address: {
                type: String,
                required: true,
                trim: true
            },
            location: {
                type: {
                    type: String,
                    enum: ["Point"],
                    default: "Point"
                },
                coordinates: {
                    type: [Number] // [longitude, latitude]
                }
            }
        },

        // Mechanic Location
        mechanicLocation: {
            address: {
                type: String,
                trim: true
            },
            location: {
                type: {
                    type: String,
                    enum: ["Point"],
                },
                coordinates: {
                    type: [Number]
                }
            }
        },

        status: {
            type: String,
            enum: ["requested", "accepted", "in_progress", "waiting_for_confirmation", "completed", "cancelled"],
            default: "requested"
        },

        totalPrice: {
            type: Number
        },

        totalDistance: {
            type: Number
        },

        totalDuration: {
            type: Number
        },

        paymentStatus: {
            type: String,
            enum: ["pending", "success", "failed"],
            default: "pending"
        },

        isActive: {
            type: Boolean,
            default: false
        },
        completionRequestedAt: {
            type: Date,
            default: null
        },
        autoCompleteAt: {
            type: Date,
            default: null
        },
        rejectedBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Mechanic"
            }
        ],
        isSOS: {
            type: Boolean,
            default: false
        },
        sentShopIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Shop"
            }
        ],
        requestImages: [
            {
                type: String
            }
        ],
    },
    {
        timestamps: true
    }
);

serviceRequestSchema.index({ shopId: 1, status: 1 });
serviceRequestSchema.index({ "customerLocation.location": "2dsphere" });
serviceRequestSchema.index({ "mechanicLocation.location": "2dsphere" });

module.exports = mongoose.model("ServiceRequest", serviceRequestSchema);