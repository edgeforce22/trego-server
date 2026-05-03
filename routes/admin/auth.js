// javascript
// =============================================
// UPDATED ADMIN DASHBOARD GET APIs
// File: routes/admin/dashboard.js
// Auto Populate all MongoDB ObjectIds
// =============================================

const express = require("express");
const router = express.Router();

const Customer = require("../../models/Customer");
const Mechanic = require("../../models/Mechanic");
const Vehicle = require("../../models/Vehicle");
const Shop = require("../../models/Shop");
const Services = require("../../models/Services");
const ServiceRequest = require("../../models/ServiceRequest");

// =============================================
// COMMON POPULATE CONFIG
// =============================================

const requestPopulate = [
    { path: "customerId", model: "Customer" },
    { path: "shopId", model: "Shop", populate: { path: "ownerId", model: "Mechanic" } },
    { path: "mechanicId", model: "Mechanic" },
    { path: "vehicleId", model: "Vehicle" },
    { path: "serviceId", model: "Services" }
];

// =============================================
// 1. OVERVIEW
// GET /api/admin/dashboard/overview
// =============================================
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
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$totalPrice" }
                }
            }
        ]);

        return res.status(200).json({
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
                totalRevenue: revenue[0]?.totalRevenue || 0
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================
// 2. CUSTOMERS
// GET /api/admin/dashboard/customers
// =============================================
router.get("/customers", async (req, res) => {
    try {
        const customers = await Customer.find().sort({ createdAt: -1 });

        const data = await Promise.all(
            customers.map(async (customer) => {

                const vehicles = await Vehicle.find({
                    customerId: customer._id
                });

                const requests = await ServiceRequest.find({
                    customerId: customer._id
                }).populate(requestPopulate);

                return {
                    ...customer.toObject(),
                    vehicles,
                    requests,
                    vehicleCount: vehicles.length,
                    requestCount: requests.length
                };
            })
        );

        res.json({ success: true, data });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================
// 3. CUSTOMER VEHICLES
// GET /api/admin/dashboard/customer-vehicles
// =============================================
router.get("/customer-vehicles", async (req, res) => {
    try {
        const data = await Vehicle.find()
            .populate("customerId")
            .sort({ _id: -1 });

        res.json({ success: true, data });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================
// 4. CUSTOMER REQUESTS
// =============================================
router.get("/customer-requests", async (req, res) => {
    try {
        const data = await ServiceRequest.find()
            .populate(requestPopulate)
            .sort({ createdAt: -1 });

        res.json({ success: true, data });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================
// 5. MECHANICS
// =============================================
router.get("/mechanics", async (req, res) => {
    try {

        const mechanics = await Mechanic.find()
            .populate("shopId")
            .sort({ createdAt: -1 });

        const data = await Promise.all(
            mechanics.map(async (mech) => {

                const completedJobs = await ServiceRequest.countDocuments({
                    mechanicId: mech._id,
                    status: "completed"
                });

                const activeJobs = await ServiceRequest.countDocuments({
                    mechanicId: mech._id,
                    status: { $in: ["accepted", "in_progress"] }
                });

                return {
                    ...mech.toObject(),
                    completedJobs,
                    activeJobs
                };
            })
        );

        res.json({ success: true, data });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================
// 6. SHOPS
// =============================================
router.get("/shops", async (req, res) => {
    try {
        const data = await Shop.find()
            .populate("ownerId")
            .populate("workers")
            .sort({ createdAt: -1 });

        res.json({ success: true, data });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================
// 7. SERVICES
// =============================================
router.get("/services", async (req, res) => {
    try {
        const data = await Services.find()
            .populate({
                path: "shopId",
                populate: {
                    path: "ownerId",
                    model: "Mechanic"
                }
            });

        res.json({ success: true, data });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================
// 8. WORKERS
// =============================================
router.get("/workers", async (req, res) => {
    try {

        const workers = await Mechanic.find({
            role: "worker"
        }).populate("shopId");

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
                }).populate(requestPopulate);

                return {
                    ...worker.toObject(),
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

// =============================================
// 9. ALL REQUESTS
// =============================================
router.get("/requests", async (req, res) => {
    try {
        const data = await ServiceRequest.find()
            .populate(requestPopulate)
            .sort({ createdAt: -1 });

        res.json({ success: true, data });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================
// 10. ANALYTICS
// =============================================
router.get("/analytics", async (req, res) => {
    try {

        const requestTrend = await ServiceRequest.aggregate([
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                        day: { $dayOfMonth: "$createdAt" }
                    },
                    total: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
        ]);

        const topShops = await ServiceRequest.aggregate([
            { $match: { status: "completed" } },
            {
                $group: {
                    _id: "$shopId",
                    jobs: { $sum: 1 },
                    revenue: { $sum: "$totalPrice" }
                }
            },
            { $sort: { revenue: -1 } },
            { $limit: 5 }
        ]);

        await Shop.populate(topShops, {
            path: "_id"
        });

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