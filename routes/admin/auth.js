// javascript
// ================================
// ADMIN DASHBOARD GET APIs
// File: routes/admin/dashboard.js
// Base Route: /api/admin/dashboard
// ================================

const express = require("express");
const router = express.Router();

const Customer = require("../../models/Customer");
const Mechanic = require("../../models/Mechanic");
const Vehicle = require("../../models/Vehicle");
const Shop = require("../../models/Shop");
const Services = require("../../models/Services");
const ServiceRequest = require("../../models/ServiceRequest");

// =====================================================
// 1. DASHBOARD OVERVIEW
// GET /api/admin/dashboard/overview
// =====================================================
router.get("/overview", async (req, res) => {
    try {
        const totalCustomers = await Customer.countDocuments();
        const totalMechanics = await Mechanic.countDocuments();
        const activeMechanics = await Mechanic.countDocuments({ status: "active" });
        const inactiveMechanics = await Mechanic.countDocuments({ status: "inactive" });

        const totalShops = await Shop.countDocuments();

        const activeRequests = await ServiceRequest.countDocuments({
            status: { $in: ["requested", "accepted", "in_progress"] }
        });

        const completedRequests = await ServiceRequest.countDocuments({
            status: "completed"
        });

        const cancelledRequests = await ServiceRequest.countDocuments({
            status: "cancelled"
        });

        const sosRequests = await ServiceRequest.countDocuments({
            isSOS: true
        });

        const revenue = await ServiceRequest.aggregate([
            { $match: { status: "completed" } },
            { $group: { _id: null, total: { $sum: "$totalPrice" } } }
        ]);

        res.json({
            success: true,
            data: {
                totalCustomers,
                totalMechanics,
                activeMechanics,
                inactiveMechanics,
                totalShops,
                activeRequests,
                completedRequests,
                cancelledRequests,
                sosRequests,
                totalRevenue: revenue[0]?.total || 0
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
// 2. GET ALL CUSTOMERS
// GET /api/admin/dashboard/customers
// =====================================================
router.get("/customers", async (req, res) => {
    try {
        const customers = await Customer.find().sort({ createdAt: -1 });

        const data = await Promise.all(
            customers.map(async (customer) => {
                const vehicleCount = await Vehicle.countDocuments({
                    customerId: customer._id
                });

                const requestCount = await ServiceRequest.countDocuments({
                    customerId: customer._id
                });

                return {
                    ...customer._doc,
                    vehicleCount,
                    requestCount
                };
            })
        );

        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
// 3. CUSTOMER VEHICLES
// GET /api/admin/dashboard/customer-vehicles
// =====================================================
router.get("/customer-vehicles", async (req, res) => {
    try {
        const data = await Vehicle.aggregate([
            {
                $lookup: {
                    from: "customers",
                    localField: "customerId",
                    foreignField: "_id",
                    as: "customer"
                }
            },
            { $unwind: "$customer" }
        ]);

        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
// 4. CUSTOMER REQUESTS
// GET /api/admin/dashboard/customer-requests
// =====================================================
router.get("/customer-requests", async (req, res) => {
    try {
        const data = await ServiceRequest.find()
            .populate("customerId")
            .populate("shopId")
            .populate("mechanicId")
            .populate("vehicleId")
            .populate("serviceId")
            .sort({ createdAt: -1 });

        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
// 5. GET ALL MECHANICS
// GET /api/admin/dashboard/mechanics
// =====================================================
router.get("/mechanics", async (req, res) => {
    try {
        const mechanics = await Mechanic.find().sort({ createdAt: -1 });

        const data = await Promise.all(
            mechanics.map(async (mech) => {
                const completedJobs = await ServiceRequest.countDocuments({
                    mechanicId: mech._id,
                    status: "completed"
                });

                return {
                    ...mech._doc,
                    completedJobs
                };
            })
        );

        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
// 6. SHOPS DATA
// GET /api/admin/dashboard/shops
// =====================================================
router.get("/shops", async (req, res) => {
    try {
        const data = await Shop.find()
            .populate("ownerId")
            .sort({ createdAt: -1 });

        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
// 7. SERVICES DATA
// GET /api/admin/dashboard/services
// =====================================================
router.get("/services", async (req, res) => {
    try {
        const data = await Services.find()
            .populate("shopId")
            .sort({ createdAt: -1 });

        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
// 8. WORKERS DATA
// GET /api/admin/dashboard/workers
// =====================================================
router.get("/workers", async (req, res) => {
    try {
        const workers = await Mechanic.find({
            role: { $ne: "owner" }
        });

        const data = await Promise.all(
            workers.map(async (worker) => {
                const assignedJobs = await ServiceRequest.countDocuments({
                    mechanicId: worker._id
                });

                const completedJobs = await ServiceRequest.countDocuments({
                    mechanicId: worker._id,
                    status: "completed"
                });

                const activeJob = await ServiceRequest.findOne({
                    mechanicId: worker._id,
                    status: { $in: ["accepted", "in_progress"] }
                });

                return {
                    ...worker._doc,
                    assignedJobs,
                    completedJobs,
                    activeJob
                };
            })
        );

        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
// 9. REQUEST MONITORING
// GET /api/admin/dashboard/requests
// =====================================================
router.get("/requests", async (req, res) => {
    try {
        const data = await ServiceRequest.find()
            .populate("customerId")
            .populate("mechanicId")
            .populate("shopId")
            .sort({ createdAt: -1 });

        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
// 10. ANALYTICS
// GET /api/admin/dashboard/analytics
// =====================================================
router.get("/analytics", async (req, res) => {
    try {
        const requestTrend = await ServiceRequest.aggregate([
            {
                $group: {
                    _id: {
                        day: { $dayOfMonth: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    total: { $sum: 1 }
                }
            }
        ]);

        const topShops = await ServiceRequest.aggregate([
            { $match: { status: "completed" } },
            {
                $group: {
                    _id: "$shopId",
                    totalJobs: { $sum: 1 },
                    revenue: { $sum: "$totalPrice" }
                }
            },
            { $sort: { revenue: -1 } },
            { $limit: 5 }
        ]);

        res.json({
            success: true,
            data: {
                requestTrend,
                topShops
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;