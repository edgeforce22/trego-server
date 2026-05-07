const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const Customer = require("../../models/Customer");
const Mechanic = require("../../models/Mechanic");
const ApiResponse = require("../../utils/model/ApiResponse");
const Vehicle = require("../../models/Vehicle");
const Shop = require("../../models/Shop");
const Services = require("../../models/Services");
const ServiceRequest = require("../../models/ServiceRequest");
const ShopRating = require("../../models/ShopRating");
const admin = require("../../utils/firebase/firebase");
const { sendNotificationToShop } = require("../../utils/notification/notificationServices");

// ================= REGISTER =================
router.post("/register", async (req, res) => {
    console.log("-----API Customer Registration-----");
    try {
        console.log("Request:", req.body);
        const { name, phoneNumber, address, password, latitude, longitude } = req.body;

        // Validation
        if (!name || !phoneNumber || !address || !password || !latitude || !longitude) {
            console.log("Error :", "All fields are required");
            return res.status(400).json(
                ApiResponse.error("All fields are required", 400)
            );
        }

        // Check existing user
        const existingUser = await Customer.findOne({ phoneNumber });

        if (existingUser) {
            console.log("Error :", "User already exists");
            return res.status(409).json(
                ApiResponse.error("User already exists", 409)
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await Customer.create({
            name,
            phoneNumber,
            address,
            location: {
                type: "Point",
                coordinates: [longitude, latitude]
            },
            password: hashedPassword
        });

        console.log("User registered successfully");
        return res.status(201).json(
            ApiResponse.success("User registered successfully", {
                _id: user._id,
                name: user.name,
                phoneNumber: user.phoneNumber,
                address: user.address
            })
        );

    } catch (err) {
        console.error(err);
        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});


// ================= LOGIN =================
router.post("/login", async (req, res) => {
    console.log("-----API Customer Login-----");
    try {
        console.log("Request:", req.body)
        const { phoneNumber, password } = req.body;

        // Validation
        if (!phoneNumber || !password) {
            console.log("Phone number and password are required");
            return res.status(400).json(
                ApiResponse.error("Phone number and password are required", 400)
            );
        }


        // Find user
        const user = await Customer.findOne({ phoneNumber });
        if (!user) {
            console.log("Invalid phone number or password");
            return res.status(401).json(
                ApiResponse.error("Invalid phone number or password", 401)
            );
        }

        // Compare password
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            console.log("Invalid phone number or password");
            return res.status(401).json(
                ApiResponse.error("Invalid phone number or password", 401)
            );
        }

        console.log("Login successful");
        return res.json(
            ApiResponse.success("Login successful",
                {
                    _id: user._id,
                    name: user.name,
                    phoneNumber: user.phoneNumber,
                    address: user.address
                }
            )
        );

    } catch (err) {
        console.error(err);
        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});


// =============== Create Vehicle ====================
router.post("/createVehicle", async (req, res) => {
    console.log("-----API Customer Create Vehicle-----");

    try {
        const {
            customerId,
            vehicleType,
            vehicleBrand,
            vehicleModel,
            registrationNumber
        } = req.body;

        // Validate required fields
        if (!customerId || !vehicleType || !vehicleBrand || !vehicleModel) {
            console.log("Missing Field required: ", req.body, customerId);
            return res.status(400).json(
                ApiResponse.error("Missing required fields", 400)
            );
        }

        console.log("Missing Field required: ", req.body);
        // Registration number required for non-bicycle vehicles
        if (vehicleType !== "bicycle" && !registrationNumber) {
            return res.status(400).json(
                ApiResponse.error("Registration number required", 400)
            );
        }

        let existingVehicle = null;

        // Check duplicates
        if (vehicleType !== "bicycle") {
            existingVehicle = await Vehicle.findOne({ registrationNumber });
        }

        if (existingVehicle) {
            return res.status(400).json(
                ApiResponse.error("Vehicle already registered", 400)
            );
        }

        console.log("Missing Field required: ", existingVehicle);
        // Create new vehicle
        const vehicle = new Vehicle({
            customerId,
            vehicleType,
            vehicleBrand,
            vehicleModel,
            registrationNumber: vehicleType === "bicycle" ? null : registrationNumber
        });

        await vehicle.save();

        console.log("Vehicle Registered Successfully", vehicle);

        return res.status(201).json(
            ApiResponse.success("Vehicle created successfully", vehicle)
        );

    } catch (err) {
        console.error(err);

        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});



// =============== Get Vehicle ====================
router.post("/getVehicles", async (req, res) => {
    console.log("-----API Get Customer Vehicles-----");

    try {
        const { id } = req.body;

        // Validate required fields
        if (!id) {
            console.log("Customer Id is invalid!", id);
            return res.status(400).json(
                ApiResponse.error("Customer Id is invalid", 400)
            );
        }

        const customerId = id;
        // Find vehicles by customerId
        const vehicles = await Vehicle.find({ customerId });

        // Check if vehicles exist
        if (!vehicles || vehicles.length === 0) {
            console.log("Vehicles not found", vehicles);
            return res.status(404).json(
                ApiResponse.error("No vehicles found for this customer", 404)
            );
        }

        console.log("Vehicle fetched successfully", vehicles);
        return res.status(200).json(
            ApiResponse.success("Vehicles fetched successfully", vehicles)
        );

    } catch (err) {
        console.error(err);

        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});


// ==================== Get Services By ShopId ==========================
router.post("/getShopServices", async (req, res) => {
    console.log("-----API Get Shop Services-----");

    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json(
                ApiResponse.error("ShopId is required", 400)
            );
        }

        const shopId = id;
        const shopExists = await Shop.findById(shopId);
        if (!shopExists) {
            return res.status(404).json(
                ApiResponse.error("Shop not found", 404)
            );
        }

        const services = await Services.find({ shopId });

        if (!services || services.length === 0) {
            console.log("No services found for this shop");
            return res.status(404).json(
                ApiResponse.error("No services found for this shop", 404)
            );
        }

        console.log("Services fetched successfully", services);
        return res.status(200).json(
            ApiResponse.success("Services fetched successfully", services)
        );

    } catch (err) {
        console.error(err);
        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});


// ==================== Get User Data ==========================
router.post("/getUserData", async (req, res) => {
    console.log("-----API Customer User Data Get-----");

    try {

        const { customerId } = req.body;

        if (!customerId) {
            return res.status(400).json(
                ApiResponse.error("Invalid customerId", 400)
            );
        }

        const user = await Customer.findById(customerId);

        if (!user) {
            return res.status(404).json(
                ApiResponse.error("Customer not found", 404)
            );
        }

        return res.status(200).json(
            ApiResponse.success("User data fetched successfully", {
                _id: user._id,
                name: user.name,
                phoneNumber: user.phoneNumber,
                address: user.address
            })
        );

    } catch (err) {
        console.error(err);
        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});


// // Returns all the shops both active and inactive
// // ================= Get Nearby Shops =================
// router.post("/nearbyShops", async (req, res) => {
//     console.log("-----API Nearby Shops-----");

//     try {
//         const { latitude, longitude } = req.body;

//         if (latitude === undefined || longitude === undefined) {
//             console.log("Fields Required", latitude + " & " + longitude);
//             return res.status(400).json(
//                 ApiResponse.error("Latitude and longitude are required", 400)
//             );
//         }

//         const lat = parseFloat(latitude);
//         const lng = parseFloat(longitude);

//         const shops = await Shop.aggregate([
//             {
//                 $geoNear: {
//                     near: {
//                         type: "Point",
//                         coordinates: [lng, lat]
//                     },
//                     distanceField: "distance",
//                     maxDistance: 10000, // 10 km
//                     spherical: true
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "mechanics",
//                     localField: "ownerId",
//                     foreignField: "_id",
//                     as: "owner"
//                 }
//             },
//             {
//                 $unwind: "$owner"
//             },
//             {
//                 $project: {
//                     _id: 1,
//                     ownerId: "$owner._id",
//                     shopName: 1,
//                     phoneNumber: 1,
//                     rating: 1,
//                     address: 1,
//                     openingTime: 1,
//                     closingTime: 1,

//                     latitude: { $arrayElemAt: ["$location.coordinates", 1] },
//                     longitude: { $arrayElemAt: ["$location.coordinates", 0] },

//                     distance: {
//                         $round: [
//                             { $divide: ["$distance", 1000] },
//                             2
//                         ]
//                     },

//                     estimatedTime: {
//                         $round: [
//                             {
//                                 $multiply: [
//                                     {
//                                         $divide: [
//                                             { $divide: ["$distance", 1000] },
//                                             40
//                                         ]
//                                     },
//                                     60
//                                 ]
//                             },
//                             0
//                         ]
//                     }
//                 }
//             },
//             { $limit: 20 }
//         ]);

//         if (!shops || shops.length === 0) {
//             console.log("No nearby shops found");
//             return res.status(404).json(
//                 ApiResponse.error("No nearby shops found", 404)
//             );
//         }

//         console.log("Nearby shops fetched successfully", shops);

//         return res.status(200).json(
//             ApiResponse.success("Nearby shops fetched successfully", shops)
//         );

//     } catch (err) {
//         console.error(err);
//         return res.status(500).json(
//             ApiResponse.error("Server error", 500)
//         );
//     }
// });


// ================= Get Nearby Shops =================
router.post("/nearbyShops", async (req, res) => {
    console.log("-----API Nearby Shops-----");

    try {
        const { latitude, longitude } = req.body;

        if (latitude === undefined || longitude === undefined) {
            console.log("Fields Required", latitude + " & " + longitude);
            return res.status(400).json(
                ApiResponse.error("Latitude and longitude are required", 400)
            );
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        const shops = await Shop.aggregate([
            {
                $geoNear: {
                    near: {
                        type: "Point",
                        coordinates: [lng, lat]
                    },
                    distanceField: "distance",
                    maxDistance: 10000,
                    spherical: true,

                    // ✅ STRICT FILTER (ONLY ACTIVE SHOPS)
                    query: {
                        status: { $eq: "active" }
                    }
                }
            },
            {
                $lookup: {
                    from: "mechanics",
                    localField: "ownerId",
                    foreignField: "_id",
                    as: "owner"
                }
            },
            {
                $unwind: "$owner"
            },
            {
                $project: {
                    _id: 1,
                    ownerId: "$owner._id",
                    shopName: 1,
                    phoneNumber: 1,
                    rating: 1,
                    address: 1,
                    openingTime: 1,
                    closingTime: 1,
                    supportedVehicles: 1,
                    shopImage: 1,

                    latitude: { $arrayElemAt: ["$location.coordinates", 1] },
                    longitude: { $arrayElemAt: ["$location.coordinates", 0] },

                    distance: {
                        $round: [
                            { $divide: ["$distance", 1000] },
                            2
                        ]
                    },

                    estimatedTime: {
                        $round: [
                            {
                                $multiply: [
                                    {
                                        $divide: [
                                            { $divide: ["$distance", 1000] },
                                            40
                                        ]
                                    },
                                    60
                                ]
                            },
                            0
                        ]
                    }
                }
            },
            { $limit: 20 }
        ]);

        if (!shops || shops.length === 0) {
            console.log("No nearby shops found", shops);
            return res.status(404).json(
                ApiResponse.error("No nearby shops found", 404)
            );
        }

        console.log("Nearby shops fetched successfully", shops);

        return res.status(200).json(
            ApiResponse.success("Nearby shops fetched successfully", shops)
        );

    } catch (err) {
        console.error(err);
        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});


// // =============== Get Nearby Mechanics ====================
// router.post("/nearbyMechanics", async (req, res) => {
//     console.log("-----API Nearby Mechanics-----");

//     try {
//         const { latitude, longitude } = req.body;

//         // Validate input
//         if (!latitude || !longitude) {
//             return res.status(400).json(
//                 ApiResponse.error("Latitude and longitude are required", 400)
//             );
//         }

//         const lat = parseFloat(latitude);
//         const lng = parseFloat(longitude);

//         // Find nearby active mechanics
//         const mechanics = await Mechanic.find({
//             status: "active",
//             location: {
//                 $near: {
//                     $geometry: {
//                         type: "Point",
//                         coordinates: [lng, lat]
//                     },
//                     $maxDistance: 10000 // 10 km
//                 }
//             }
//         })
//             .populate("shop", "shopName address") // optional
//             .limit(20);

//         return res.status(200).json(
//             ApiResponse.success(mechanics, "Nearby mechanics fetched")
//         );

//     } catch (err) {
//         console.error(err);
//         return res.status(500).json(
//             ApiResponse.error("Server error", 500)
//         );
//     }
// });




// // ================= Create Request (Customer) =================
// router.post("/createRequest", async (req, res) => {

//     console.log("-----API Create Request-----");

//     try {

//         const {
//             customerId,
//             shopId,
//             vehicleId,
//             serviceId,
//             problemDescription,
//             customerLocation,
//             totalPrice,
//             totalDistance,
//             totalDuration
//         } = req.body;

//         if (
//             !customerId ||
//             !shopId ||
//             !vehicleId ||
//             !serviceId ||
//             !problemDescription ||
//             !customerLocation ||
//             !customerLocation.address ||
//             customerLocation.latitude === undefined ||
//             customerLocation.longitude === undefined
//         ) {
//             return res.status(400).json(
//                 ApiResponse.error("Missing required fields", 400)
//             );
//         }

//         const request = await ServiceRequest.create({

//             customerId,
//             shopId,
//             vehicleId,
//             serviceId,
//             problemDescription,

//             customerLocation: {
//                 address: customerLocation.address,
//                 location: {
//                     type: "Point",
//                     coordinates: [
//                         parseFloat(customerLocation.longitude),
//                         parseFloat(customerLocation.latitude)
//                     ]
//                 }
//             },

//             totalPrice,
//             totalDistance,
//             totalDuration
//         });

//         // ================= SEND FCM NOTIFICATION =================

//         // const shop = await Shop.findById(shopId);

//         // if (shop && shop.fcmToken) {

//         //     const message = {
//         //         token: shop.fcmToken,

//         //         notification: {
//         //             title: "New Service Request 🚗",
//         //             body: "A customer has requested a mechanic service"
//         //         },

//         //         data: {
//         //             title: "New Service Request 🚗",
//         //             body: "A customer has requested a mechanic service",
//         //             serviceId: request._id.toString(),
//         //             requestStatus: request.status,
//         //             type: "SERVICE_REQUEST"
//         //         }
//         //     };

//         //     await admin.messaging().send(message);

//         //     console.log("Notification sent to mechanic");
//         // }

//         await sendNotificationToShop(shopId, {
//             title: "New Service Request 🚗",
//             body: "Your shop have received a new service request",
//             data: {
//                 title: "New Service Request 🚗",
//                 body: "A customer has requested a mechanic service",
//                 serviceId: request._id.toString(),
//                 requestStatus: request.status,
//                 type: "SERVICE_REQUEST"
//             }
//         })

//         // =========================================================

//         const response = {
//             _id: request._id,
//             customerId: request.customerId,
//             shopId: request.shopId,
//             vehicleId: request.vehicleId,
//             serviceId: request.serviceId,
//             problemDescription: request.problemDescription,
//             totalPrice: request.totalPrice,
//             totalDistance: request.totalDistance,
//             totalDuration: request.totalDuration,
//             status: request.status,
//             paymentStatus: request.paymentStatus,

//             customerLocation: {
//                 latitude: request.customerLocation.location.coordinates[1],
//                 longitude: request.customerLocation.location.coordinates[0],
//                 address: request.customerLocation.address
//             },

//             createdAt: request.createdAt
//         };

//         return res.status(201).json(
//             ApiResponse.success("Request created successfully", response)
//         );

//     } catch (err) {

//         console.error(err);

//         return res.status(500).json(
//             ApiResponse.error("Failed to create request", 500)
//         );
//     }
// });



const { emitNewRequest, emitRemoveRequest } = require("../../utils/socket/socket");

const upload =
    require("../../middleware/upload");

router.post(

    "/createRequest",

    upload.array("requestImages", 5),

    async (req, res) => {

        console.log("-----API Create Request-----");

        try {

            const {

                customerId,
                shopId,
                vehicleId,
                serviceId,
                problemDescription,
                customerLocation,
                totalPrice,
                totalDistance,
                totalDuration

            } = req.body;

            console.log("Received service request: ", req.body);
            /*
             * PARSE LOCATION
             */
            let parsedLocation = customerLocation;

            if (typeof customerLocation === "string") {

                parsedLocation =
                    JSON.parse(customerLocation);
            }

            /*
             * VALIDATION
             */
            if (
                !customerId ||
                !shopId ||
                !vehicleId ||
                !serviceId ||
                !problemDescription
            ) {

                console.log("Missing required fields ", req.body);
                return res.status(400).json(

                    ApiResponse.error(
                        "Missing required fields",
                        400
                    )
                );
            }

            /*
             * IMAGE URLS
             */
            let requestImages = [];

            if (req.files && req.files.length > 0) {

                requestImages =
                    req.files.map(
                        file => file.path
                    );
            }

            /*
             * CREATE REQUEST
             */
            const request =
                await ServiceRequest.create({

                    customerId,

                    shopId,

                    vehicleId,

                    serviceId,

                    problemDescription,

                    requestImages,

                    customerLocation: {

                        address:
                            parsedLocation.address,

                        location: {

                            type: "Point",

                            coordinates: [

                                parseFloat(
                                    parsedLocation.longitude
                                ),

                                parseFloat(
                                    parsedLocation.latitude
                                )
                            ]
                        }
                    },

                    totalPrice,
                    totalDistance,
                    totalDuration

                });

            /*
            * FETCH CUSTOMER
            */
            const customer =
                await Customer.findById(
                    customerId
                );

            /*
             * FETCH SERVICE
             */
            const service =
                await Services.findById(
                    serviceId
                );

            /*
             * SOCKET DATA
             */
            const socketData = {

                _id: request._id,

                customerId:
                    request.customerId,

                customerName:
                    customer?.name || "",

                shopId:
                    request.shopId,

                vehicleId:
                    request.vehicleId,

                serviceId:
                    request.serviceId,

                serviceName:
                    service?.service || "",

                serviceDescription:
                    service?.description || "",

                problemDescription:
                    request.problemDescription,

                requestImages:
                    request.requestImages,

                status:
                    request.status,

                totalPrice:
                    request.totalPrice,

                totalDistance:
                    request.totalDistance,

                totalDuration:
                    request.totalDuration,

                paymentStatus:
                    request.paymentStatus,

                customerLocation: {

                    latitude:
                        request.customerLocation
                            .location
                            .coordinates[1],

                    longitude:
                        request.customerLocation
                            .location
                            .coordinates[0],

                    address:
                        request.customerLocation
                            .address
                },

                createdAt:
                    request.createdAt
            };

            /*
             * SOCKET EMIT
             */
            emitNewRequest(
                shopId,
                socketData
            );

            /*
             * NOTIFICATION
             */
            await sendNotificationToShop(
                shopId,
                {
                    title:
                        "New Service Request 🚗",

                    body:
                        "New service request received",

                    data: {

                        title:
                            "New Service Request 🚗",

                        body:
                            "Customer requested service",

                        serviceId:
                            request._id.toString(),

                        requestStatus:
                            request.status,

                        type:
                            "SERVICE_REQUEST"
                    }
                }
            );

            console.log("Request created successfully ", socketData);
            /*
             * RESPONSE
             */
            return res.status(201).json(

                ApiResponse.success(
                    "Request created successfully",

                    socketData
                )
            );

        } catch (err) {

            console.error(err);

            return res.status(500).json(

                ApiResponse.error(
                    "Failed to create request",
                    500
                )
            );
        }
    }
);

// router.post("/createRequest", async (req, res) => {

//     console.log("-----API Create Request-----");

//     try {

//         const {
//             customerId,
//             shopId,
//             vehicleId,
//             serviceId,
//             problemDescription,
//             customerLocation,
//             totalPrice,
//             totalDistance,
//             totalDuration
//         } = req.body;

//         if (
//             !customerId ||
//             !shopId ||
//             !vehicleId ||
//             !serviceId ||
//             !problemDescription ||
//             !customerLocation ||
//             !customerLocation.address ||
//             customerLocation.latitude === undefined ||
//             customerLocation.longitude === undefined
//         ) {
//             return res.status(400).json(
//                 ApiResponse.error("Missing required fields", 400)
//             );
//         }

//         const request = await ServiceRequest.create({

//             customerId,
//             shopId,
//             vehicleId,
//             serviceId,
//             problemDescription,

//             customerLocation: {
//                 address: customerLocation.address,
//                 location: {
//                     type: "Point",
//                     coordinates: [
//                         parseFloat(customerLocation.longitude),
//                         parseFloat(customerLocation.latitude)
//                     ]
//                 }
//             },

//             totalPrice,
//             totalDistance,
//             totalDuration
//         });

//         // ================= SOCKET (🔥 MOST IMPORTANT FIX) =================

//         // 🔥 Format data same as Android expects
//         const socketData = {
//             _id: request._id,
//             customerId: request.customerId,
//             shopId: request.shopId,
//             vehicleId: request.vehicleId,
//             serviceId: request.serviceId,
//             problemDescription: request.problemDescription,
//             status: request.status,
//             totalPrice: request.totalPrice,
//             totalDistance: request.totalDistance,
//             totalDuration: request.totalDuration,
//             paymentStatus: request.paymentStatus,

//             customerLocation: {
//                 latitude: request.customerLocation.location.coordinates[1],
//                 longitude: request.customerLocation.location.coordinates[0],
//                 address: request.customerLocation.address
//             },

//             createdAt: request.createdAt
//         };

//         // 🔥 Emit FULL request to all mechanics in shop
//         emitNewRequest(shopId, socketData);

//         // ================================================================


//         // ================= FCM NOTIFICATION =================

//         await sendNotificationToShop(shopId, {
//             title: "New Service Request 🚗",
//             body: "Your shop have received a new service request",
//             data: {
//                 title: "New Service Request 🚗",
//                 body: "A customer has requested a mechanic service",
//                 serviceId: request._id.toString(),
//                 requestStatus: request.status,
//                 type: "SERVICE_REQUEST"
//             }
//         });

//         // =========================================================


//         // ================= RESPONSE =================

//         const response = socketData;

//         return res.status(201).json(
//             ApiResponse.success("Request created successfully", response)
//         );

//     } catch (err) {

//         console.error(err);

//         return res.status(500).json(
//             ApiResponse.error("Failed to create request", 500)
//         );
//     }
// });



// const { emitNewRequest } = require("../../utils/socket/socket");

router.post("/sendSOS", async (req, res) => {

    console.log("-----API SOS REQUEST-----");

    try {

        const { customerId, latitude, longitude, address, problemTypes } = req.body;

        if (!customerId || !latitude || !longitude || !address || !problemTypes?.length) {
            console.log("Missing required field :", req.body);
            return res.status(400).json(
                ApiResponse.error("Missing required fields", 400)
            );
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        console.log("SOS Sent Data : ", req.body);
        // ================= FIND NEARBY SHOPS =================
        const nearbyShops = await Shop.aggregate([
            {
                $geoNear: {
                    near: {
                        type: "Point",
                        coordinates: [lng, lat]
                    },
                    distanceField: "distance",
                    maxDistance: 10000,
                    spherical: true
                }
            },
            { $limit: 20 }
        ]);

        if (!nearbyShops.length) {
            console.log("No nearby mechanics found");
            return res.status(404).json(
                ApiResponse.error("No nearby mechanics found", 404)
            );
        }

        // ================= CREATE REQUEST =================
        const request = await ServiceRequest.create({
            customerId,
            problemDescription: problemTypes.join(", "),
            status: "requested",   // 🔥 IMPORTANT (match your system)
            isSOS: true,


            sentShopIds: nearbyShops.map(shop => shop._id),

            customerLocation: {
                address: address,
                location: {
                    type: "Point",
                    coordinates: [lng, lat]
                }
            }
        });

        // ================= SOCKET DATA =================
        const socketData = {
            _id: request._id,
            customerId: request.customerId,
            problemDescription: request.problemDescription,
            status: request.status,
            type: "SOS",
            isSOS: true,

            customerLocation: {
                latitude: lat,
                longitude: lng,
                address: address
            },

            createdAt: request.createdAt
        };

        // ================= BROADCAST =================
        nearbyShops.forEach(shop => {
            console.log("📢 Sending SOS to shop:", shop._id);
            emitNewRequest(shop._id, socketData);
        });

        console.log("SOS sent successfully :", nearbyShops);
        return res.status(201).json(
            ApiResponse.success("SOS sent successfully", {
                id: request._id
            })
        );

    } catch (err) {
        console.error("SOS Error:", err);
        return res.status(500).json(
            ApiResponse.error("SOS failed", 500)
        );
    }
});


// router.post("/getServiceRequest", async (req, res) => {
//     console.log("-----API Get Service Request By ID-----");

//     try {
//         const { id } = req.body;

//         if (!id) {
//             return res.status(400).json(
//                 ApiResponse.error("Request ID is required", 400)
//             );
//         }

//         const request = await ServiceRequest.findById(id);

//         if (!request) {
//             return res.status(404).json(
//                 ApiResponse.error("Service request not found", 404)
//             );
//         }

//         const shop = await Shop.findById(request.shopId);
//         const service = await Services.findById(request.serviceId);

//         // ===============================
//         // Calculate total mechanics
//         // ===============================

//         let totalMechanics = 0;
//         let rejectedCount = 0;
//         let isCompletelyRejected = false;

//         if (shop) {
//             const allMembers = [
//                 shop.ownerId?.toString(),
//                 ...(shop.workers || []).map(id => id.toString())
//             ];

//             // remove duplicates
//             const uniqueMembers = [...new Set(allMembers)];

//             totalMechanics = uniqueMembers.length;

//             rejectedCount = (request.rejectedBy || []).length;

//             isCompletelyRejected =
//                 rejectedCount >= totalMechanics &&
//                 totalMechanics > 0 &&
//                 request.status === "requested";
//         }

//         const response = {
//             _id: request._id,
//             customerId: request.customerId,
//             shopId: request.shopId,
//             mechanicId: request.mechanicId,
//             vehicleId: request.vehicleId,
//             serviceId: request.serviceId,

//             shopName: shop ? shop.shopName : "",
//             serviceName: service ? service.service : "",

//             problemDescription: request.problemDescription,
//             status: request.status,
//             totalPrice: request.totalPrice,
//             totalDistance: request.totalDistance,
//             totalDuration: request.totalDuration,
//             paymentStatus: request.paymentStatus,

//             rejectedCount,
//             totalMechanics,
//             isCompletelyRejected,

//             customerLocation: request.customerLocation ? {
//                 latitude: request.customerLocation.location.coordinates[1],
//                 longitude: request.customerLocation.location.coordinates[0],
//                 address: request.customerLocation.address
//             } : null,

//             mechanicLocation:
//                 request.mechanicLocation?.location?.coordinates ? {
//                     latitude: request.mechanicLocation.location.coordinates[1],
//                     longitude: request.mechanicLocation.location.coordinates[0],
//                     address: request.mechanicLocation.address
//                 } : null,

//             createdAt: request.createdAt
//         };

//         console.log("Service Request Data :", response)
//         return res.status(200).json(
//             ApiResponse.success(
//                 "Service request fetched successfully",
//                 response
//             )
//         );

//     } catch (err) {
//         console.error(err);

//         return res.status(500).json(
//             ApiResponse.error("Server error", 500)
//         );
//     }
// });


// ================= Get Service Request By Id =================
router.post("/getServiceRequest", async (req, res) => {
    console.log("-----API Get Service Request By ID-----");

    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json(
                ApiResponse.error("Request ID is required", 400)
            );
        }

        const request = await ServiceRequest.findById(id);

        if (!request) {
            return res.status(404).json(
                ApiResponse.error("Service request not found", 404)
            );
        }

        // Get shop name and service name using IDs
        const shop = await Shop.findById(request.shopId).select(
            `
                shopName
                ownerId
                workers
                supportedVehicles
                rating
                ratingCount
                ratingSum
                `
        );
        const service = await Services.findById(request.serviceId).select("service");

        const customer =
            await Customer.findById(
                request.customerId
            ).select(
                "name phoneNumber"
            );

        const mechanic =
            await Mechanic.findById(
                request.mechanicId
            ).select(
                "name phoneNumber"
            );

        // ===============================
        // Calculate total mechanics
        // ===============================

        let totalMechanics = 0;
        let rejectedCount = 0;
        let isCompletelyRejected = false;

        if (shop) {
            const allMembers = [
                shop.ownerId?.toString(),
                ...(shop.workers || []).map(id => id.toString())
            ];

            // Remove duplicate members
            const uniqueMembers = [...new Set(allMembers)];

            totalMechanics = uniqueMembers.length;

            rejectedCount = (request.rejectedBy || []).length;

            isCompletelyRejected =
                rejectedCount >= totalMechanics &&
                totalMechanics > 0 &&
                request.status === "requested";
        }

        const response = {

            _id:
                request._id,

            /*
             * CUSTOMER DETAILS
             */
            customerId:
                request.customerId,

            customerName:
                customer
                    ? customer.name
                    : "",

            customerPhoneNumber:
                customer
                    ? customer.phoneNumber
                    : "",

            /*
             * SHOP DETAILS
             */
            shopId:
                request.shopId,

            shopName:
                shop
                    ? shop.shopName
                    : "",

            supportedVehicles:
                shop?.supportedVehicles || [],

            /*
             * MECHANIC DETAILS
             */
            mechanicId:
                request.mechanicId,

            mechanicName:
                mechanic
                    ? mechanic.name
                    : "",

            mechanicPhoneNumber:
                mechanic
                    ? mechanic.phoneNumber
                    : "",

            isSOS: request.isSOS,
            /*
             * VEHICLE DETAILS
             */
            vehicleId:
                request.vehicleId,

            /*
             * SERVICE DETAILS
             */
            serviceId:
                request.serviceId,

            serviceName:
                service
                    ? service.service
                    : "",

            serviceDescription:
                service
                    ? (
                        service.description ||
                        ""
                    )
                    : "",

            serviceAmount:
                service
                    ? (
                        service.amount ||
                        service.price ||
                        0
                    )
                    : 0,

            /*
             * SHOP RATING
             */
            shopRating:
                shop?.rating || 0,

            shopRatingCount:
                shop?.ratingCount || 0,

            shopRatingSum:
                shop?.ratingSum || 0,

            /*
             * REQUEST DETAILS
             */
            problemDescription:
                request.problemDescription,

            status:
                request.status,

            totalPrice:
                request.totalPrice,

            totalDistance:
                request.totalDistance,

            totalDuration:
                request.totalDuration,

            paymentStatus:
                request.paymentStatus,

            /*
             * REJECTION DETAILS
             */
            rejectedCount,

            totalMechanics,

            isCompletelyRejected,

            /*
             * CUSTOMER LOCATION
             */
            customerLocation:
                request.customerLocation
                    ? {

                        latitude:
                            request.customerLocation
                                .location
                                .coordinates[1],

                        longitude:
                            request.customerLocation
                                .location
                                .coordinates[0],

                        address:
                            request.customerLocation
                                .address
                    }
                    : null,

            /*
             * MECHANIC LOCATION
             */
            mechanicLocation:
                request.mechanicLocation?.location?.coordinates

                    ? {

                        latitude:
                            request.mechanicLocation
                                .location
                                .coordinates[1],

                        longitude:
                            request.mechanicLocation
                                .location
                                .coordinates[0],

                        address:
                            request.mechanicLocation
                                .address
                    }

                    : null,

            createdAt:
                request.createdAt
        };

        console.log("Service Request Data :", response);

        return res.status(200).json(
            ApiResponse.success(
                "Service request fetched successfully",
                response
            )
        );

    } catch (err) {
        console.error(err);

        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});


// ================= Get Service Request History =================
router.post("/getServiceRequestHistory", async (req, res) => {
    console.log("-----API Get Service Request History-----");

    try {

        const { id } = req.body;

        if (!id) {
            return res.status(400).json(
                ApiResponse.error("Customer ID is required", 400)
            );
        }

        const allowedStatus = [
            "accepted",
            "in_progress",
            "waiting_for_confirmation",
            "completed",
            "cancelled"
        ];

        const requests = await ServiceRequest.find({
            customerId: id,
            status: { $in: allowedStatus }
        }).sort({ createdAt: -1 });

        const response = await Promise.all(
            requests.map(async (request) => {

                const shop =
                    await Shop.findById(request.shopId);

                const service =
                    await Services.findById(request.serviceId);

                return {
                    _id: request._id,
                    customerId: request.customerId,
                    shopId: request.shopId,
                    mechanicId: request.mechanicId,
                    vehicleId: request.vehicleId,
                    serviceId: request.serviceId,

                    shopName:
                        shop ? shop.shopName : "",
                    supportedVehicles: shop?.supportedVehicles || [],

                    serviceName:
                        service ? service.service : "",

                    problemDescription:
                        request.problemDescription,

                    isSOS: request.isSOS,

                    status: request.status,
                    totalPrice: request.totalPrice,
                    totalDistance: request.totalDistance,
                    totalDuration: request.totalDuration,
                    paymentStatus: request.paymentStatus,

                    customerLocation:
                        request.customerLocation ? {
                            latitude:
                                request.customerLocation
                                    .location.coordinates[1],
                            longitude:
                                request.customerLocation
                                    .location.coordinates[0],
                            address:
                                request.customerLocation
                                    .address
                        } : null,

                    mechanicLocation:
                        request.mechanicLocation?.location?.coordinates ? {
                            latitude:
                                request.mechanicLocation
                                    .location.coordinates[1],
                            longitude:
                                request.mechanicLocation
                                    .location.coordinates[0],
                            address:
                                request.mechanicLocation
                                    .address
                        } : null,

                    createdAt: request.createdAt
                };
            })
        );

        return res.status(200).json(
            ApiResponse.success(
                "Service request history fetched successfully",
                response
            )
        );

    } catch (err) {

        console.error(err);

        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});





// // ================= Get Service Request By ID =================
// router.post("/getServiceRequest", async (req, res) => {
//     console.log("-----API Get Service Request By ID-----");

//     try {

//         const { id } = req.body;

//         const requestId = id;
//         if (!requestId) {
//             console.log("Request ID is required!", requestId);
//             return res.status(400).json(
//                 ApiResponse.error("Request ID is required", 400)
//             );
//         }

//         const request = await ServiceRequest.findById(requestId);

//         if (!request) {
//             console.log("Request ID is required!", request);
//             return res.status(404).json(
//                 ApiResponse.error("Service request not found", 404)
//             );
//         }

//         const response = {
//             _id: request._id,
//             customerId: request.customerId,
//             shopId: request.shopId,
//             mechanicId: request.mechanicId,
//             vehicleId: request.vehicleId,
//             serviceId: request.serviceId,
//             problemDescription: request.problemDescription,
//             status: request.status,
//             totalPrice: request.totalPrice,
//             totalDistance: request.totalDistance,
//             totalDuration: request.totalDuration,
//             paymentStatus: request.paymentStatus,

//             customerLocation: request.customerLocation ? {
//                 latitude: request.customerLocation.location.coordinates[1],
//                 longitude: request.customerLocation.location.coordinates[0],
//                 address: request.customerLocation.address
//             } : null,

//             mechanicLocation: request.mechanicLocation?.location?.coordinates ? {
//                 latitude: request.mechanicLocation.location.coordinates[1],
//                 longitude: request.mechanicLocation.location.coordinates[0],
//                 address: request.mechanicLocation.address
//             } : null,

//             createdAt: request.createdAt
//         };

//         console.log("Service request fetched successfully", response);
//         return res.status(200).json(
//             ApiResponse.success("Service request fetched successfully", response)
//         );

//     } catch (err) {

//         console.error(err);

//         return res.status(500).json(
//             ApiResponse.error("Server error", 500)
//         );
//     }
// });

// router.post("/getServiceRequestHistory", async (req, res) => {
//     console.log("-----API Get Service Request History-----");

//     try {

//         const { id } = req.body;

//         const customerId = id;
//         if (!customerId) {
//             console.log("Customer ID is required!");
//             return res.status(400).json(
//                 ApiResponse.error("Customer ID is required", 400)
//             );
//         }

//         const allowedStatus = [
//             "accepted",
//             "in_progress",
//             "waiting_for_confirmation",
//             "completed",
//             "cancelled"
//         ];

//         const requests = await ServiceRequest.find({
//             customerId: customerId,
//             status: { $in: allowedStatus }
//         }).sort({ createdAt: -1 });

//         const response = requests.map(request => ({
//             _id: request._id,
//             customerId: request.customerId,
//             shopId: request.shopId,
//             mechanicId: request.mechanicId,
//             vehicleId: request.vehicleId,
//             serviceId: request.serviceId,
//             problemDescription: request.problemDescription,
//             status: request.status,
//             totalPrice: request.totalPrice,
//             totalDistance: request.totalDistance,
//             totalDuration: request.totalDuration,
//             paymentStatus: request.paymentStatus,

//             customerLocation: request.customerLocation ? {
//                 latitude:
//                     request.customerLocation.location.coordinates[1],
//                 longitude:
//                     request.customerLocation.location.coordinates[0],
//                 address:
//                     request.customerLocation.address
//             } : null,

//             mechanicLocation:
//                 request.mechanicLocation?.location?.coordinates ? {
//                     latitude:
//                         request.mechanicLocation.location.coordinates[1],
//                     longitude:
//                         request.mechanicLocation.location.coordinates[0],
//                     address:
//                         request.mechanicLocation.address
//                 } : null,

//             createdAt: request.createdAt
//         }));

//         console.log(
//             "Service request history fetched successfully"
//         );

//         return res.status(200).json(
//             ApiResponse.success(
//                 "Service request history fetched successfully",
//                 response
//             )
//         );

//     } catch (err) {

//         console.error(err);

//         return res.status(500).json(
//             ApiResponse.error("Server error", 500)
//         );
//     }
// });

// ================= Customer Cancel Request =================
router.post("/cancelRequestedService", async (req, res) => {

    console.log("-----API Customer Cancel Service Request-----");

    try {

        const { id } = req.body;
        const requestId = id;

        if (!requestId) {
            console.log("Request ID is required", req.body);
            return res.status(400).json(
                ApiResponse.error("Request ID is required", 400)
            );
        }

        const request = await ServiceRequest.findByIdAndUpdate(
            requestId,
            {
                status: "cancelled"
            },
            { returnDocument: 'after' }
        );

        if (!request) {
            console.log("Request not found");
            return res.status(404).json(
                ApiResponse.error("Request not found", 404)
            );
        }

        // ================= SEND FCM NOTIFICATION =================

        // const shop = await Shop.findById(shopId);

        // if (shop && shop.fcmToken) {

        //     const message = {
        //         token: shop.fcmToken,

        //         notification: {
        //             title: "Customer cancelled your request",
        //             body: "Wait for an another request..."
        //         },

        //         data: {
        //             title: "Customer cancelled your request",
        //             body: "Wait for an another request...",
        //             serviceId: request._id.toString(),
        //             requestStatus: request.status,
        //             type: "SERVICE_REQUEST"
        //         }
        //     };

        //     await admin.messaging().send(message);

        //     console.log("Notification sent to mechanic");
        // }

        // =========================================================


        if (request.isSOS) {

            // Remove from ALL shop dashboards
            if (request.sentShopIds?.length) {

                request.sentShopIds.forEach(shopId => {
                    emitRemoveRequest(shopId, request._id);
                });
            }

        } else {

            // Normal request remove from one shop
            emitRemoveRequest(request.shopId, request._id);
        }

        await sendNotificationToShop(request.shopId, {
            title: "Service Request Cancelled",
            body: "The request was cancelled because it had not been accepted yet",
            data: {
                title: "Service Request Cancelled",
                body: "The request was cancelled because it had not been accepted yet",
                serviceId: request._id.toString(),
                requestStatus: request.status,
                type: "SERVICE_REQUEST"
            }
        });


        // Format response for Android
        const response = {
            _id: request._id,
            customerId: request.customerId,
            shopId: request.shopId,
            mechanicId: request.mechanicId,
            vehicleId: request.vehicleId,
            serviceId: request.serviceId,
            problemDescription: request.problemDescription,
            totalPrice: request.totalPrice,
            totalDistance: request.totalDistance,
            totalDuration: request.totalDuration,
            status: request.status,
            paymentStatus: request.paymentStatus,

            customerLocation: request.customerLocation?.location?.coordinates
                ? {
                    latitude: request.customerLocation.location.coordinates[1],
                    longitude: request.customerLocation.location.coordinates[0],
                    address: request.customerLocation.address
                }
                : null,

            mechanicLocation: request.mechanicLocation?.location?.coordinates
                ? {
                    latitude: request.mechanicLocation.location.coordinates[1],
                    longitude: request.mechanicLocation.location.coordinates[0],
                    address: request.mechanicLocation.address
                }
                : null,

            createdAt: request.createdAt
        };

        console.log("Requested Service cancelled successfully", response);

        return res.status(200).json(
            ApiResponse.success("Requested Service cancelled successfully", response)
        );

    } catch (err) {

        console.error(err);

        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});



// ================= Customer Confirm Completion =================
router.post("/confirmServiceCompletion", async (req, res) => {

    console.log("-----API Customer Confirm Service Completion-----");

    try {

        const { id } = req.body;
        const requestId = id;

        // ✅ Validation
        if (!requestId) {
            console.log("Request ID required", requestId);
            return res.status(400).json(
                ApiResponse.error("Request ID required", 400)
            );
        }

        const request = await ServiceRequest.findById(requestId);

        if (!request) {
            console.log("Request not found", request);
            return res.status(404).json(
                ApiResponse.error("Request not found", 404)
            );
        }

        // ❗ Only allow from waiting_for_confirmation
        if (request.status !== "waiting_for_confirmation") {
            console.log("Invalid status transition", request.status);
            return res.status(400).json(
                ApiResponse.error("Service is not waiting for confirmation", 400)
            );
        }

        // ✅ Update status
        request.status = "completed";
        request.completedAt = new Date();
        request.isActive = false;

        // 🔥 Clear auto-complete fields
        request.autoCompleteAt = null;
        request.completionRequestedAt = null;

        await request.save();

        console.log("Service completed by customer", request._id);

        // ================= SEND FCM NOTIFICATION =================

        // ================= SEND FCM NOTIFICATION =================

        try {

            const mechanic =
                await Mechanic.findById(
                    request.mechanicId
                );

            if (mechanic?.fcmToken) {

                await admin.messaging().send({

                    token:
                        mechanic.fcmToken,

                    notification: {

                        title:
                            "Service Completed ✅",

                        body:
                            "Customer confirmed service completion"
                    },

                    data: {

                        title:
                            "Service Completed ✅",

                        body:
                            "Customer confirmed service completion",

                        serviceId:
                            request._id.toString(),

                        requestStatus:
                            request.status,

                        type:
                            "SERVICE_COMPLETED"
                    }
                });

                console.log(
                    "Notification sent to mechanic"
                );
            }

        } catch (notifyErr) {

            console.error(
                "Notification error:",
                notifyErr
            );
        }

        // =========================================================

        return res.status(200).json(
            ApiResponse.success("Service completed successfully", {
                _id: request._id,
                status: request.status,
                completedAt: request.completedAt
            })
        );

    } catch (err) {

        console.error(err);

        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});



// ================= Update Customer FCM Token =================
router.put("/updateCustomerFcmToken", async (req, res) => {

    console.log("-----API Update Customer FCM Token-----");

    try {

        const { customerId, fcmToken } = req.body;

        if (!customerId || !fcmToken) {
            console.log("Invalid body: ", req.body);
            return res.status(400).json(
                ApiResponse.error("customerId and fcmToken are required", 400)
            );
        }

        const customer = await Customer.findByIdAndUpdate(
            customerId,
            { fcmToken: fcmToken },
            { returnDocument: 'after' }
        );

        if (!customer) {
            console.log("Customer not found: ", customer);
            return res.status(404).json(
                ApiResponse.error("Customer not found", 404)
            );
        }

        console.log("FCM token updated successfully");

        return res.status(200).json(
            ApiResponse.success(
                "FCM token updated successfully",
                {
                    customerId: customer._id,
                    fcmToken: customer.fcmToken
                }
            )
        );

    } catch (error) {

        console.error("Error updating FCM token:", error);

        return res.status(500).json(
            ApiResponse.error("Failed to update FCM token", 500)
        );
    }
});


// ================= Update Customer Location =================
router.post("/updateLocation", async (req, res) => {
    console.log("-----API Update Customer Location-----");

    try {
        const { customerId, latitude, longitude, address } = req.body;

        // Validate input
        if (!customerId || !latitude || !longitude) {
            return res.status(400).json(
                ApiResponse.error("customerId, latitude and longitude are required", 400)
            );
        }

        const customer = await Customer.findByIdAndUpdate(
            customerId,
            {
                address,
                location: {
                    type: "Point",
                    coordinates: [
                        parseFloat(longitude),
                        parseFloat(latitude)
                    ]
                }
            },
            { returnDocument: 'after' }
        );

        if (!customer) {
            return res.status(404).json(
                ApiResponse.error("Customer not found", 404)
            );
        }

        return res.status(200).json(
            ApiResponse.success(customer, "Location updated successfully")
        );

    } catch (error) {
        console.error(error);

        return res.status(500).json(
            ApiResponse.error(error.message, 500)
        );
    }
});


// ==================== Add / Update Shop Rating ==========================
router.post("/rateShop", async (req, res) => {

    console.log("-----API Rate Shop-----");

    try {

        let {
            shopId,
            userId,
            rating
        } = req.body;

        console.log(
            "shopId, userId and rating :",
            req.body
        );

        /*
         * VALIDATION
         */
        if (
            !shopId ||
            !userId ||
            rating === undefined
        ) {

            return res.status(400).json(
                ApiResponse.error(
                    "shopId, userId and rating are required",
                    400
                )
            );
        }

        /*
         * CONVERT TO NUMBER
         */
        rating =
            parseFloat(rating);

        /*
         * VALIDATE
         */
        if (
            isNaN(rating) ||
            rating < 0 ||
            rating > 5
        ) {

            return res.status(400).json(
                ApiResponse.error(
                    "Rating must be between 0 and 5",
                    400
                )
            );
        }

        /*
         * FIND SHOP
         */
        const shop =
            await Shop.findById(shopId);

        if (!shop) {

            return res.status(404).json(
                ApiResponse.error(
                    "Shop not found",
                    404
                )
            );
        }

        /*
         * FIND EXISTING USER RATING
         */
        const existingRating =
            await ShopRating.findOne({
                shopId,
                userId
            });

        /*
         * UPDATE EXISTING
         */
        if (existingRating) {

            existingRating.rating =
                rating;

            await existingRating.save();
        }

        /*
         * CREATE NEW
         */
        else {

            await ShopRating.create({

                shopId,

                userId,

                rating
            });
        }

        /*
         * RECALCULATE FROM DATABASE
         */
        const allRatings =
            await ShopRating.find({
                shopId
            });

        /*
         * TOTAL COUNT
         */
        const ratingCount =
            allRatings.length;

        /*
         * TOTAL SUM
         */
        const ratingSum =
            allRatings.reduce(

                (sum, item) =>

                    sum + Number(item.rating || 0),

                0
            );

        /*
         * AVERAGE
         */
        const averageRating =

            ratingCount > 0

                ? ratingSum / ratingCount

                : 0;

        /*
         * UPDATE SHOP
         */
        shop.rating =
            Number(
                averageRating.toFixed(1)
            );

        shop.ratingCount =
            ratingCount;

        shop.ratingSum =
            ratingSum;

        /*
         * SAVE SHOP
         */
        await shop.save();

        console.log({

            rating:
                shop.rating,

            ratingCount:
                shop.ratingCount,

            ratingSum:
                shop.ratingSum
        });

        return res.status(200).json(

            ApiResponse.success(

                "Rating submitted successfully",

                {
                    rating:
                        shop.rating,

                    ratingCount:
                        shop.ratingCount,

                    ratingSum:
                        shop.ratingSum
                }
            )
        );

    } catch (err) {

        console.error(
            "RATE SHOP ERROR"
        );

        console.error(err);

        return res.status(500).json(

            ApiResponse.error(

                err.message ||

                "Server error",

                500
            )
        );
    }
});


// // ==================== Add / Update Shop Rating ==========================
// router.post("/rateShop", async (req, res) => {

//     console.log("-----API Rate Shop-----");

//     try {

//         let {
//             shopId,
//             userId,
//             rating
//         } = req.body;

//         /*
//          * VALIDATION
//          */
//         if (
//             !shopId ||
//             !userId ||
//             rating === undefined
//         ) {

//             console.log(
//                 "shopId, userId and rating are required",
//                 req.body
//             );

//             return res.status(400).json(
//                 ApiResponse.error(
//                     "shopId, userId and rating are required",
//                     400
//                 )
//             );
//         }

//         /*
//          * CONVERT RATING TO NUMBER
//          */
//         rating = Number(rating);

//         /*
//          * VALIDATE RATING
//          */
//         if (
//             isNaN(rating) ||
//             rating < 0 ||
//             rating > 5
//         ) {

//             console.log(
//                 "Rating must be between 0 and 5",
//                 req.body
//             );

//             return res.status(400).json(
//                 ApiResponse.error(
//                     "Rating must be between 0 and 5",
//                     400
//                 )
//             );
//         }

//         /*
//          * FIND SHOP
//          */
//         const shop =
//             await Shop.findById(shopId);

//         if (!shop) {

//             console.log(
//                 "Shop not found",
//                 req.body
//             );

//             return res.status(404).json(
//                 ApiResponse.error(
//                     "Shop not found",
//                     404
//                 )
//             );
//         }

//         /*
//          * SAFETY DEFAULTS
//          */
//         if (
//             typeof shop.ratingCount !== "number"
//         ) {

//             shop.ratingCount = 0;
//         }

//         if (
//             typeof shop.ratingSum !== "number"
//         ) {

//             shop.ratingSum = 0;
//         }

//         /*
//          * CHECK EXISTING RATING
//          */
//         const existingRating =
//             await ShopRating.findOne({
//                 shopId,
//                 userId
//             });

//         /*
//          * UPDATE EXISTING RATING
//          */
//         if (existingRating) {

//             const oldRating =
//                 existingRating.rating || 0;

//             existingRating.rating =
//                 rating;

//             await existingRating.save();

//             /*
//              * UPDATE TOTAL SUM
//              */
//             shop.ratingSum =
//                 shop.ratingSum -
//                 oldRating +
//                 rating;
//         }

//         /*
//          * CREATE NEW RATING
//          */
//         else {

//             await ShopRating.create({

//                 shopId,

//                 userId,

//                 rating
//             });

//             shop.ratingCount += 1;

//             shop.ratingSum += rating;
//         }

//         /*
//          * CALCULATE AVERAGE RATING
//          */
//         shop.rating =
//             shop.ratingCount > 0

//                 ? Number(
//                     (
//                         shop.ratingSum /
//                         shop.ratingCount
//                     ).toFixed(1)
//                 )

//                 : 0;

//         /*
//          * SAVE SHOP
//          */
//         await shop.save();

//         console.log(
//             "Rating submitted successfully",
//             {
//                 rating: shop.rating,
//                 ratingCount:
//                     shop.ratingCount
//             }
//         );

//         /*
//          * SUCCESS RESPONSE
//          */
//         return res.status(200).json(

//             ApiResponse.success(
//                 "Rating submitted successfully",

//                 {
//                     rating:
//                         shop.rating,

//                     ratingCount:
//                         shop.ratingCount
//                 }
//             )
//         );

//     } catch (err) {

//         console.error(
//             "RATE SHOP ERROR"
//         );

//         console.error(err);

//         return res.status(500).json(

//             ApiResponse.error(
//                 err.message ||
//                 "Server error",
//                 500
//             )
//         );
//     }
// });



// ================= Get Live Requested Requests =================
router.post("/getLiveRequestedRequest", async (req, res) => {

    console.log(
        "-----API Get Live Requested Requests-----"
    );

    try {

        const { id } = req.body;

        const customerId = id;

        /*
         * VALIDATION
         */
        if (!customerId) {

            console.log(
                "Customer Id is required : ",
                customerId
            );

            return res.status(400).json(

                ApiResponse.error(
                    "customerId is required",
                    400
                )
            );
        }

        /*
         * FETCH LIVE REQUESTS
         */
        const requests =
            await ServiceRequest.find({

                customerId,

                status: {

                    $in: [

                        "requested",

                        "accepted",

                        "in_progress",

                        "waiting_for_confirmation"
                    ]
                }
            })

                /*
                 * SHOP DETAILS
                 */
                .populate({

                    path: "shopId",

                    select:
                        "shopName supportedVehicles"
                })

                /*
                 * SERVICE DETAILS
                 */
                .populate({

                    path: "serviceId",

                    select:
                        "service description"
                })

                /*
                 * MECHANIC DETAILS
                 */
                .populate({

                    path: "mechanicId",

                    select:
                        "name"
                })

                .sort({
                    createdAt: -1
                })

                .limit(20);

        /*
         * EMPTY RESPONSE
         */
        if (
            !requests ||
            requests.length === 0
        ) {

            return res.status(404).json(

                ApiResponse.error(
                    "No live requests found",
                    404
                )
            );
        }

        /*
         * FORMAT RESPONSE
         */
        const formatted =
            requests.map(request => ({

                _id:
                    request._id,

                customerId:
                    request.customerId,

                shopId:
                    request.shopId?._id || null,

                mechanicId:
                    request.mechanicId?._id || null,

                vehicleId:
                    request.vehicleId,

                serviceId:
                    request.serviceId?._id || null,

                /*
                 * SHOP DETAILS
                 */
                shopName:
                    request.shopId?.shopName || "",

                supportedVehicles:
                    request.shopId
                        ?.supportedVehicles || [],

                /*
                 * SERVICE DETAILS
                 */
                serviceName:
                    request.serviceId
                        ?.service || "",

                serviceDescription:
                    request.serviceId
                        ?.description || "",

                /*
                 * MECHANIC DETAILS
                 */
                mechanicName:
                    request.mechanicId
                        ?.name || "",

                /*
                 * REQUEST DETAILS
                 */
                problemDescription:
                    request.problemDescription,

                totalPrice:
                    request.totalPrice,

                totalDistance:
                    request.totalDistance,

                totalDuration:
                    request.totalDuration,

                status:
                    request.status,

                paymentStatus:
                    request.paymentStatus,

                /*
                 * CUSTOMER LOCATION
                 */
                customerLocation:

                    request.customerLocation
                        ?.location
                        ?.coordinates

                        ? {

                            latitude:

                                request
                                    .customerLocation
                                    .location
                                    .coordinates[1],

                            longitude:

                                request
                                    .customerLocation
                                    .location
                                    .coordinates[0],

                            address:
                                request
                                    .customerLocation
                                    .address
                        }

                        : null,

                /*
                 * MECHANIC LOCATION
                 */
                mechanicLocation:

                    request.mechanicLocation
                        ?.location
                        ?.coordinates

                        ? {

                            latitude:

                                request
                                    .mechanicLocation
                                    .location
                                    .coordinates[1],

                            longitude:

                                request
                                    .mechanicLocation
                                    .location
                                    .coordinates[0],

                            address:
                                request
                                    .mechanicLocation
                                    .address
                        }

                        : null,

                createdAt:
                    request.createdAt
            }));

        /*
         * SUCCESS RESPONSE
         */
        return res.status(200).json(

            ApiResponse.success(

                "Live requests fetched successfully",

                formatted
            )
        );

    } catch (err) {

        console.error(
            "GET LIVE REQUEST ERROR"
        );

        console.error(err);

        return res.status(500).json(

            ApiResponse.error(
                "Server error",
                500
            )
        );
    }
});



// // ================= Get Live Requested Requests =================
// router.post("/getLiveRequestedRequest", async (req, res) => {
//     console.log("-----API Get Live Requested Requests-----");

//     try {

//         const { id } = req.body;
//         const customerId = id;

//         if (!customerId) {
//             console.log("Customer Id is required : ", customerId);
//             return res.status(400).json(
//                 ApiResponse.error("customerId is required", 400)
//             );
//         }

//         // 🔥 Fetch only LIVE requests (active statuses)
//         const requests = await ServiceRequest.find({
//             customerId,
//             status: {
//                 $in: [
//                     "requested",
//                     "accepted",
//                     "in_progress",
//                     "waiting_for_confirmation"
//                 ]
//             }
//         })
//             .sort({ createdAt: -1 }) // 🔥 Latest first
//             .limit(20); // optional limit

//         const shop = await Shop.findById(req.shopId)
//             .select(
//                 "shopName supportedVehicles"
//             );

//         if (!requests || requests.length === 0) {
//             return res.status(404).json(
//                 ApiResponse.error("No live requests found", 404)
//             );
//         }

//         // 🔥 Format response exactly like Android expects
//         const formatted = requests.map(req => ({

//             _id: req._id,
//             customerId: req.customerId,
//             shopId: req.shopId,
//             mechanicId: req.mechanicId,
//             vehicleId: req.vehicleId,
//             serviceId: req.serviceId,
//             problemDescription: req.problemDescription,

//             totalPrice: req.totalPrice,
//             totalDistance: req.totalDistance,
//             totalDuration: req.totalDuration,

//             shopName:
//                 shop?.shopName || "",

//             supportedVehicles:
//                 shop?.supportedVehicles || [],

//             status: req.status,
//             paymentStatus: req.paymentStatus,

//             customerLocation: req.customerLocation?.location?.coordinates
//                 ? {
//                     latitude: req.customerLocation.location.coordinates[1],
//                     longitude: req.customerLocation.location.coordinates[0],
//                     address: req.customerLocation.address
//                 }
//                 : null,

//             mechanicLocation: req.mechanicLocation?.location?.coordinates
//                 ? {
//                     latitude: req.mechanicLocation.location.coordinates[1],
//                     longitude: req.mechanicLocation.location.coordinates[0],
//                     address: req.mechanicLocation.address
//                 }
//                 : null,

//             createdAt: req.createdAt
//         }));

//         return res.status(200).json(
//             ApiResponse.success("Live requests fetched successfully", formatted)
//         );

//     } catch (err) {
//         console.error(err);
//         return res.status(500).json(
//             ApiResponse.error("Server error", 500)
//         );
//     }
// });

// ================= Get Mechanic Details =================
router.post("/getMechanicDetails", async (req, res) => {
    console.log("-----API Get Mechanic Details-----");

    try {
        const { id } = req.body;
        const mechanicId = id;

        if (!mechanicId) {
            return res.status(400).json(
                ApiResponse.error("mechanicId is required", 400)
            );
        }

        const mechanic = await Mechanic.findById(mechanicId)
            .select("name phoneNumber");

        if (!mechanic) {
            return res.status(404).json(
                ApiResponse.error("Mechanic not found", 404)
            );
        }

        return res.status(200).json(
            ApiResponse.success("Mechanic fetched successfully", mechanic)
        );

    } catch (err) {
        console.error(err);
        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});

// ================= Get Shop Details =================
router.post("/getShopDetails", async (req, res) => {
    console.log("-----API Get Shop Details-----");

    try {
        const { id } = req.body;
        const shopId = id;

        if (!shopId) {
            return res.status(400).json(
                ApiResponse.error("shopId is required", 400)
            );
        }

        const shop = await Shop.findById(shopId)
            .select("shopImage shopName phoneNumber rating address status openingTime closingTime supportedVehicles");

        if (!shop) {
            return res.status(404).json(
                ApiResponse.error("Shop not found", 404)
            );
        }

        return res.status(200).json(
            ApiResponse.success("Shop fetched successfully", shop)
        );

    } catch (err) {
        console.error(err);
        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});

module.exports = router;
