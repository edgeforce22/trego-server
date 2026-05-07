const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const Mechanic = require("../../models/Mechanic");
const ApiResponse = require("../../utils/model/ApiResponse");
const Shop = require("../../models/Shop");
const Services = require("../../models/Services");
const ServiceRequest = require("../../models/ServiceRequest");
const Customer = require("../../models/Customer");
const admin = require("../../utils/firebase/firebase");
const { emitRemoveRequest, emitOrderStatusUpdate, emitSOSAccepted } = require("../../utils/socket/socket");

// ================= REGISTER =================
router.post("/register", async (req, res) => {
    console.log("-----API Mechanic Registration-----");
    try {
        console.log("Request:", req.body)
        const { name, phoneNumber, role, address, password, latitude, longitude, status } = req.body;

        // Validation
        if (!name || !phoneNumber || !address || !password || !latitude || !longitude) {
            console.log("Error :", "All fields are required");
            return res.status(400).json(
                ApiResponse.error("All fields are required", 400)
            );
        }


        // Check existing user
        const existingUser = await Mechanic.findOne({ phoneNumber });

        if (existingUser) {
            console.log("Error :", "User already exists");
            return res.status(409).json(
                ApiResponse.error("User already exists", 409)
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await Mechanic.create({
            name,
            phoneNumber,
            role,
            address,
            location: {
                type: "Point",
                coordinates: [longitude, latitude]
            },
            password: hashedPassword,
            status
        });

        console.log("User registered successfully");
        return res.status(201).json(
            ApiResponse.success("User registered successfully", {
                _id: user._id,
                name: user.name,
                phoneNumber: user.phoneNumber,
                role: user.role,
                address: user.address,
                status: user.status
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
    console.log("-----API Mechanic Login-----");
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
        const user = await Mechanic.findOne({ phoneNumber });
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
        console.log({
            _id: user._id,
            shopId: user.shopId,
            name: user.name,
            phoneNumber: user.phoneNumber,
            role: user.role,
            address: user.address,
            status: user.status
        });
        return res.json(
            ApiResponse.success("Login successful",
                {
                    _id: user._id,
                    shopId: user.shopId,
                    name: user.name,
                    phoneNumber: user.phoneNumber,
                    role: user.role,
                    address: user.address,
                    status: user.status
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


const upload =
    require("../../middleware/upload");

router.post(

    "/registerShop",

    upload.single("shopImage"),

    async (req, res) => {

        console.log(
            "-----API Create Shop-----"
        );

        try {

            /*
             * GET BODY DATA
             */
            const {

                ownerId,
                shopName,
                phoneNumber,
                address,
                latitude,
                longitude,
                openingTime,
                closingTime,
                supportedVehicles

            } = req.body;

            /*
             * VALIDATION
             */
            if (
                !ownerId ||
                !shopName ||
                !phoneNumber ||
                !address ||
                latitude === undefined ||
                longitude === undefined
            ) {

                console.log(
                    "Missing fields occur",
                    req.body
                );

                return res.status(400).json(

                    ApiResponse.error(
                        "Missing required fields",
                        400
                    )
                );
            }

            /*
             * PARSE VEHICLES
             */
            let parsedVehicles = [];

            if (supportedVehicles) {

                try {

                    parsedVehicles =
                        JSON.parse(
                            supportedVehicles
                        );

                } catch (e) {

                    parsedVehicles = [];
                }
            }

            /*
             * CHECK SHOP EXISTS
             */
            const existingShop =
                await Shop.findOne({
                    ownerId
                });

            if (existingShop) {

                return res.status(400).json(

                    ApiResponse.error(
                        "Owner already has a shop registered",
                        400
                    )
                );
            }

            /*
             * GET SHOP IMAGE
             */
            let shopImage = "";

            if (
                req.file &&
                req.file.path
            ) {

                shopImage =
                    req.file.path;
            }

            /*
             * CREATE SHOP
             */
            const shop = new Shop({

                ownerId,

                shopName,

                phoneNumber,

                address,

                /*
                 * SHOP IMAGE
                 */
                shopImage,

                /*
                 * LOCATION
                 */
                location: {

                    type: "Point",

                    coordinates: [

                        parseFloat(longitude),

                        parseFloat(latitude)
                    ]
                },

                openingTime,

                closingTime,

                /*
                 * VEHICLES
                 */
                supportedVehicles:
                    parsedVehicles
            });

            /*
             * SAVE SHOP
             */
            await shop.save();

            console.log(
                "Shop created successfully",
                shop
            );

            /*
             * UPDATE MECHANIC
             */
            const updatedMechanic =
                await Mechanic.findByIdAndUpdate(

                    ownerId,

                    {
                        shopId: shop._id
                    },

                    {
                        new: true
                    }
                );

            console.log(
                "Updated Mechanic",
                updatedMechanic
            );

            /*
             * SUCCESS RESPONSE
             */
            return res.status(201).json(

                ApiResponse.success(

                    "Shop created successfully",

                    {

                        /*
                         * SHOP DATA
                         */
                        shop: {

                            _id:
                                shop._id,

                            ownerId:
                                shop.ownerId,

                            shopName:
                                shop.shopName,

                            phoneNumber:
                                shop.phoneNumber,

                            address:
                                shop.address,

                            shopImage:
                                shop.shopImage,

                            latitude:
                                shop.location
                                    .coordinates[1],

                            longitude:
                                shop.location
                                    .coordinates[0],

                            openingTime:
                                shop.openingTime,

                            closingTime:
                                shop.closingTime,

                            supportedVehicles:
                                shop.supportedVehicles,

                            workers:
                                shop.workers,

                            createdAt:
                                shop.createdAt,

                            updatedAt:
                                shop.updatedAt
                        },

                        /*
                         * MECHANIC DATA
                         */
                        mechanic: {

                            _id:
                                updatedMechanic._id,

                            shopId:
                                updatedMechanic.shopId,

                            name:
                                updatedMechanic.name,

                            phoneNumber:
                                updatedMechanic.phoneNumber,

                            role:
                                updatedMechanic.role,

                            address:
                                updatedMechanic.address,

                            status:
                                updatedMechanic.status,

                            profileImage:
                                updatedMechanic.profileImage
                        }
                    }
                )
            );

            console.log("Shop created successfully",

                {

                    /*
                     * SHOP DATA
                     */
                    shop: {

                        _id:
                            shop._id,

                        ownerId:
                            shop.ownerId,

                        shopName:
                            shop.shopName,

                        phoneNumber:
                            shop.phoneNumber,

                        address:
                            shop.address,

                        shopImage:
                            shop.shopImage,

                        latitude:
                            shop.location
                                .coordinates[1],

                        longitude:
                            shop.location
                                .coordinates[0],

                        openingTime:
                            shop.openingTime,

                        closingTime:
                            shop.closingTime,

                        supportedVehicles:
                            shop.supportedVehicles,

                        workers:
                            shop.workers,

                        createdAt:
                            shop.createdAt,

                        updatedAt:
                            shop.updatedAt
                    },

                    /*
                     * MECHANIC DATA
                     */
                    mechanic: {

                        _id:
                            updatedMechanic._id,

                        shopId:
                            updatedMechanic.shopId,

                        name:
                            updatedMechanic.name,

                        phoneNumber:
                            updatedMechanic.phoneNumber,

                        role:
                            updatedMechanic.role,

                        address:
                            updatedMechanic.address,

                        status:
                            updatedMechanic.status,

                        profileImage:
                            updatedMechanic.profileImage
                    }
                })

        } catch (err) {

            console.error(
                "REGISTER SHOP ERROR"
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
    }
);


// // ==================== Register Shop ==========================
// router.post("/registerShop", async (req, res) => {

//     console.log("-----API Create Shop-----");

//     try {

//         const {
//             ownerId,
//             shopName,
//             phoneNumber,
//             address,
//             latitude,
//             longitude,
//             openingTime,
//             closingTime,
//             supportedVehicles
//         } = req.body;

//         /*
//          * VALIDATION
//          */
//         if (
//             !ownerId ||
//             !shopName ||
//             !phoneNumber ||
//             !address ||
//             latitude === undefined ||
//             longitude === undefined ||
//             !supportedVehicles ||
//             supportedVehicles.length === 0
//         ) {

//             console.log(
//                 "Missing fields occur",
//                 req.body
//             );

//             return res.status(400).json(
//                 ApiResponse.error(
//                     "Missing required fields",
//                     400
//                 )
//             );
//         }

//         /*
//          * CHECK SHOP EXISTS
//          */
//         const existingShop =
//             await Shop.findOne({ ownerId });

//         if (existingShop) {

//             return res.status(400).json(
//                 ApiResponse.error(
//                     "Owner already has a shop registered",
//                     400
//                 )
//             );
//         }

//         /*
//          * CREATE SHOP
//          */
//         const shop = new Shop({

//             ownerId,
//             shopName,
//             phoneNumber,
//             address,

//             location: {
//                 type: "Point",
//                 coordinates: [
//                     longitude,
//                     latitude
//                 ]
//             },

//             openingTime,
//             closingTime,

//             supportedVehicles
//         });

//         await shop.save();

//         /*
//          * UPDATE MECHANIC
//          */
//         const updatedMechanic =
//             await Mechanic.findByIdAndUpdate(

//                 ownerId,

//                 {
//                     shopId: shop._id
//                 },

//                 {
//                     new: true
//                 }
//             );

//         console.log(
//             "Shop created successfully",
//             shop
//         );

//         console.log(
//             "Updated Mechanic",
//             updatedMechanic
//         );

//         /*
//          * RESPONSE
//          */
//         return res.status(201).json(

//             ApiResponse.success(
//                 "Shop created successfully",

//                 {
//                     shop,

//                     mechanic: {

//                         _id: updatedMechanic._id,
//                         shopId: updatedMechanic.shopId,
//                         name: updatedMechanic.name,
//                         phoneNumber:
//                             updatedMechanic.phoneNumber,
//                         role: updatedMechanic.role,
//                         address:
//                             updatedMechanic.address,
//                         status:
//                             updatedMechanic.status
//                     }
//                 }
//             )
//         );

//     } catch (err) {

//         console.error(err);

//         return res.status(500).json(
//             ApiResponse.error(
//                 "Server error",
//                 500
//             )
//         );
//     }
// });

// ==================== Get Shop Id ==========================
router.post("/getShopId", async (req, res) => {
    console.log("-----API Get Shop By Owner-----");

    try {
        const { ownerId } = req.body;

        console.log("Owner id", ownerId)
        // Validate ownerId
        if (!ownerId) {
            return res.status(400).json(
                ApiResponse.error("Owner Id is required", 400)
            );
        }

        // Find shopId by ownerId
        const shopId = await Shop.findOne({ ownerId });

        if (!shopId) {
            return res.status(404).json(
                ApiResponse.error("Shop not found for this ownerId", 404)
            );
        }

        console.log("Shop Detail Fetched successfully", shopId)
        return res.status(200).json(
            ApiResponse.success("Shop fetched successfully", shopId)
        );

    } catch (err) {
        console.error(err);
        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});


// ==================== CREATE SERVICES ====================
router.post("/createService", async (req, res) => {

    console.log("-----API Create Services-----");

    try {

        const {
            shopId,
            services
        } = req.body;

        console.log(
            "Received Request Body:",
            JSON.stringify(req.body, null, 2)
        );

        /*
         * VALIDATION
         */
        if (
            !shopId ||
            !services ||
            !Array.isArray(services) ||
            services.length === 0
        ) {

            console.log(
                "Invalid Request Data"
            );

            return res.status(400).json(
                ApiResponse.error(
                    "ShopId and services are required",
                    400
                )
            );
        }

        /*
         * CHECK SHOP
         */
        const shopExists =
            await Shop.findById(shopId);

        if (!shopExists) {

            console.log(
                "Shop not found:",
                shopId
            );

            return res.status(404).json(
                ApiResponse.error(
                    "Shop not found",
                    404
                )
            );
        }

        /*
         * CREATED SERVICES
         */
        const createdServices = [];

        /*
         * LOOP SERVICES
         */
        for (const item of services) {

            console.log(
                "Processing Service Item:",
                item
            );

            /*
             * IMPORTANT:
             * CHECK FIELD NAMES
             */
            const service =
                item.service ||
                item.serviceName;

            const description =
                item.description;

            const price =
                item.price;

            console.log(
                "Parsed Values:",
                {
                    service,
                    description,
                    price
                }
            );

            /*
             * VALIDATE SERVICE
             */
            if (
                !service ||
                !description ||
                price === undefined
            ) {

                console.log(
                    "Skipping Invalid Item:",
                    item
                );

                continue;
            }

            /*
             * PARSE PRICE
             */
            const parsedPrice =
                Number(price);

            if (isNaN(parsedPrice)) {

                console.log(
                    "Invalid Price:",
                    price
                );

                continue;
            }

            /*
             * CHECK DUPLICATE
             */
            const existingService =
                await Services.findOne({

                    shopId,
                    service
                });

            if (existingService) {

                console.log(
                    "Duplicate Service Found:",
                    service
                );

                continue;
            }

            /*
             * CREATE SERVICE
             */
            const newService =
                new Services({

                    shopId,
                    service,
                    description,
                    price: parsedPrice
                });

            /*
             * SAVE
             */
            const savedService =
                await newService.save();

            console.log(
                "Saved Service:",
                savedService
            );

            createdServices.push(
                savedService
            );
        }

        /*
         * NO SERVICES CREATED
         */
        if (createdServices.length === 0) {

            console.log(
                "No services inserted"
            );

            return res.status(400).json(
                ApiResponse.error(
                    "No valid services to create",
                    400
                )
            );
        }

        /*
         * SUCCESS RESPONSE
         */
        console.log(
            "Services Created Successfully:",
            createdServices
        );

        return res.status(201).json(

            ApiResponse.success(
                "Services created successfully",
                createdServices
            )
        );

    } catch (err) {

        console.error(
            "CREATE SERVICE ERROR:",
            err
        );

        return res.status(500).json(

            ApiResponse.error(
                "Server error",
                500
            )
        );
    }
});

// // ==================== Create Service ==========================
// router.post("/createService", async (req, res) => {
//     console.log("-----API Create Service-----");

//     try {
//         const { shopId, service, description, price } = req.body;

//         if (!shopId || !service || !description || price === undefined) {
//             return res.status(400).json(
//                 ApiResponse.error("ShopId, service name and price are required", 400)
//             );
//         }

//         const parsedPrice = Number(price);

//         if (isNaN(parsedPrice)) {
//             return res.status(400).json(
//                 ApiResponse.error("Price must be a number", 400)
//             );
//         }

//         const shopExists = await Shop.findById(shopId);
//         if (!shopExists) {
//             return res.status(404).json(
//                 ApiResponse.error("Shop not found", 404)
//             );
//         }

//         const existingService = await Services.findOne({
//             shopId,
//             service
//         });

//         if (existingService) {
//             return res.status(400).json(
//                 ApiResponse.error("Service already exists for this shop", 400)
//             );
//         }

//         const newService = new Services({
//             shopId,
//             service,
//             description,
//             price: parsedPrice
//         });

//         await newService.save();

//         console.log("Service created successfully", newService);
//         return res.status(201).json(
//             ApiResponse.success("Service created successfully", newService)
//         );

//     } catch (err) {
//         console.error(err);
//         return res.status(500).json(
//             ApiResponse.error("Server error", 500)
//         );
//     }
// });


// ==================== Get Shop Services By ShopId ==========================
router.get("/getServices", async (req, res) => {
    console.log("-----API Get Services-----");

    try {
        const { shopId } = req.body;

        if (!shopId) {
            return res.status(400).json(
                ApiResponse.error("ShopId is required", 400)
            );
        }

        const shopExists = await Shop.findById(shopId);
        if (!shopExists) {
            return res.status(404).json(
                ApiResponse.error("Shop not found", 404)
            );
        }

        const services = await Services.find({ shopId });

        if (!services || services.length === 0) {
            return res.status(404).json(
                ApiResponse.error("No services found for this shop", 404)
            );
        }

        console.log("Services fetched successfully");
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


// // Old Working
// // ==================== Update Status ==========================
// router.post("/updateStatus", async (req, res) => {
//     console.log("-----API Update Status-----");

//     try {

//         const { mechanicId, status } = req.body;

//         // Validate inputs
//         if (!mechanicId || !status) {
//             console.log("Status Update Failed");
//             return res.status(400).json(
//                 ApiResponse.error("Id and status are required", 400)
//             );
//         }

//         if (!["active", "inactive"].includes(status)) {
//             console.log("Status must be active or inactive");
//             return res.status(400).json(
//                 ApiResponse.error("Status must be active or inactive", 400)
//             );
//         }

//         // Update status
//         const mechanic = await Mechanic.findByIdAndUpdate(
//             mechanicId,
//             { status },
//             { returnDocument: 'after' }
//         );

//         if (!mechanic) {
//             return res.status(404).json(
//                 ApiResponse.error("Mechanic not found", 404)
//             );
//         }

//         console.log("Status Updated Successfully", mechanic);
//         return res.status(200).json(
//             ApiResponse.success("Status updated successfully", mechanic)
//         );

//     } catch (err) {
//         console.error(err);
//         return res.status(500).json(
//             ApiResponse.error("Server error", 500)
//         );
//     }
// });


// New Working
// ==================== Update Status ==========================
router.post("/updateStatus", async (req, res) => {
    console.log("-----API Update Status-----");

    try {

        const { mechanicId, status } = req.body;

        // Validate inputs
        if (!mechanicId || !status) {
            console.log("Status Update Failed");
            return res.status(400).json(
                ApiResponse.error("Id and status are required", 400)
            );
        }

        if (!["active", "inactive"].includes(status)) {
            console.log("Status must be active or inactive");
            return res.status(400).json(
                ApiResponse.error("Status must be active or inactive", 400)
            );
        }

        // Update mechanic status
        const mechanic = await Mechanic.findByIdAndUpdate(
            mechanicId,
            { status },
            { returnDocument: 'after' }
        );

        if (!mechanic) {
            return res.status(404).json(
                ApiResponse.error("Mechanic not found", 404)
            );
        }

        // 🔥 ADD THIS BLOCK ONLY (NO RESPONSE CHANGE)
        try {
            const shop = await Shop.findOne({ ownerId: mechanicId });

            if (shop) {
                console.log("Owner mechanic → updating shop status");

                await Shop.findByIdAndUpdate(
                    shop._id,
                    { status },
                    { returnDocument: 'after' }
                );
            }
        } catch (shopErr) {
            console.error("Shop status update failed:", shopErr.message);
        }
        // 🔥 END OF ADDITION

        console.log("Status Updated Successfully", mechanic);

        // ✅ RESPONSE UNCHANGED
        return res.status(200).json(
            ApiResponse.success("Status updated successfully", mechanic)
        );

    } catch (err) {
        console.error(err);
        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});


// router.post("/getShopServiceRequests", async (req, res) => {

//     console.log("-----API Get Available Service Requests (Filtered)-----");

//     try {

//         const { shopId, mechanicId } = req.body;

//         // ✅ Validation
//         if (!shopId || !mechanicId) {
//             return res.status(400).json(
//                 ApiResponse.error("shopId and mechanicId are required", 400)
//             );
//         }

//         // ✅ Fetch ONLY valid requests for this mechanic
//         const requests = await ServiceRequest.find({
//             shopId: shopId,
//             status: "requested",

//             // 🔥 KEY LOGIC
//             rejectedBy: { $ne: mechanicId }
//         })
//             .sort({ createdAt: -1 })
//             .lean(); // ⚡ performance boost

//         // ✅ Always return 200 (even if empty)
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

//             customerLocation: request.customerLocation?.location?.coordinates
//                 ? {
//                     latitude: request.customerLocation.location.coordinates[1],
//                     longitude: request.customerLocation.location.coordinates[0],
//                     address: request.customerLocation.address
//                 }
//                 : null,

//             mechanicLocation: request.mechanicLocation?.location?.coordinates
//                 ? {
//                     latitude: request.mechanicLocation.location.coordinates[1],
//                     longitude: request.mechanicLocation.location.coordinates[0],
//                     address: request.mechanicLocation.address
//                 }
//                 : null,

//             createdAt: request.createdAt
//         }));

//         console.log(`Requests for mechanic ${mechanicId}:`, response.length);

//         return res.status(200).json(
//             ApiResponse.success(
//                 "Service requests fetched successfully",
//                 response
//             )
//         );

//     } catch (err) {

//         console.error("Get Requests Error:", err);

//         return res.status(500).json(
//             ApiResponse.error("Server error", 500)
//         );
//     }
// });


// // ================= Get Service Request By ID =================
// router.post("/getAcceptedServiceRequest", async (req, res) => {
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



// // ================= Get Active Service Requests By ShopId & MechanicId =================
// router.post("/getActiveServiceRequests", async (req, res) => {
//     console.log("-----API Get Active Service Requests By ShopId & MechanicId-----");

//     try {

//         const { mechanicId, shopId } = req.body;

//         if (!shopId || !mechanicId) {
//             console.log("Shop ID and Mechanic ID are required!", { shopId, mechanicId });
//             return res.status(400).json(
//                 ApiResponse.error("Shop ID and Mechanic ID are required", 400)
//             );
//         }

//         const requests = await ServiceRequest.find({
//             mechanicId: mechanicId,
//             isActive: true,
//             $or: [
//                 { shopId: shopId },
//                 { isSOS: true }
//             ]
//         }).sort({ createdAt: -1 });

//         // const requests = await ServiceRequest.find({
//         //     shopId: shopId,
//         //     mechanicId: mechanicId,
//         //     isActive: true
//         // }).sort({ createdAt: -1 });

//         if (!requests || requests.length === 0) {
//             console.log("No active service requests found for this mechanic");
//             return res.status(200).json(
//                 ApiResponse.success("No active service requests found", [])
//             );
//         }

//         const response = requests.map((request) => ({
//             _id: request._id,
//             customerId: request.customerId,
//             shopId: request.shopId,
//             mechanicId: request.mechanicId,
//             vehicleId: request.vehicleId,
//             serviceId: request.serviceId,
//             problemDescription: request.problemDescription,
//             status: request.status,
//             isActive: request.isActive,
//             isSOS: request.isSOS,
//             totalPrice: request.totalPrice,
//             totalDistance: request.totalDistance,
//             totalDuration: request.totalDuration,
//             paymentStatus: request.paymentStatus,

//             customerLocation: request.customerLocation?.location?.coordinates
//                 ? {
//                     latitude: request.customerLocation.location.coordinates[1],
//                     longitude: request.customerLocation.location.coordinates[0],
//                     address: request.customerLocation.address
//                 }
//                 : null,

//             mechanicLocation: request.mechanicLocation?.location?.coordinates
//                 ? {
//                     latitude: request.mechanicLocation.location.coordinates[1],
//                     longitude: request.mechanicLocation.location.coordinates[0],
//                     address: request.mechanicLocation.address
//                 }
//                 : null,

//             createdAt: request.createdAt
//         }));

//         console.log("Active service requests fetched successfully");

//         return res.status(200).json(
//             ApiResponse.success("Active service requests fetched successfully", response)
//         );

//     } catch (err) {

//         console.error(err);

//         return res.status(500).json(
//             ApiResponse.error("Server error", 500)
//         );
//     }
// });


// // ================= Get History Service Requests By ShopId =================
// router.post("/getShopHistoryServiceRequests", async (req, res) => {
//     console.log("-----API Get History Service Requests By ShopId & MechanicId-----");

//     try {

//         const { id } = req.body;
//         const shopId = id;

//         if (!shopId) {
//             console.log("Shop ID are required!", { shopId });
//             return res.status(400).json(
//                 ApiResponse.error("Shop ID are required", 400)
//             );
//         }

//         const requests = await ServiceRequest.find({
//             shopId: shopId,

//             // ✅ History condition
//             status: { $in: ["completed", "cancelled"] }

//             // OR you can use:
//             // isActive: false
//         }).sort({ createdAt: -1 });

//         if (!requests || requests.length === 0) {
//             console.log("No history service requests found");
//             return res.status(200).json(
//                 ApiResponse.success("No history service requests found", [])
//             );
//         }

//         const response = requests.map((request) => ({
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

//             customerLocation: request.customerLocation?.location?.coordinates
//                 ? {
//                     latitude: request.customerLocation.location.coordinates[1],
//                     longitude: request.customerLocation.location.coordinates[0],
//                     address: request.customerLocation.address
//                 }
//                 : null,

//             mechanicLocation: request.mechanicLocation?.location?.coordinates
//                 ? {
//                     latitude: request.mechanicLocation.location.coordinates[1],
//                     longitude: request.mechanicLocation.location.coordinates[0],
//                     address: request.mechanicLocation.address
//                 }
//                 : null,

//             createdAt: request.createdAt
//         }));

//         console.log("History service requests fetched successfully");

//         return res.status(200).json(
//             ApiResponse.success("History service requests fetched successfully", response)
//         );

//     } catch (err) {

//         console.error(err);

//         return res.status(500).json(
//             ApiResponse.error("Server error", 500)
//         );
//     }
// });



// // ================= Get History Service Requests By ShopId & MechanicId =================
// router.post("/getWorkerHistoryServiceRequests", async (req, res) => {
//     console.log("-----API Get History Service Requests By ShopId & MechanicId-----");

//     try {

//         const { mechanicId, shopId } = req.body;

//         if (!shopId || !mechanicId) {
//             console.log("Shop ID and Mechanic ID are required!", { shopId, mechanicId });
//             return res.status(400).json(
//                 ApiResponse.error("Shop ID and Mechanic ID are required", 400)
//             );
//         }

//         const requests = await ServiceRequest.find({
//             shopId: shopId,
//             mechanicId: mechanicId,

//             // ✅ History condition
//             status: { $in: ["completed", "cancelled"] }

//             // OR you can use:
//             // isActive: false
//         }).sort({ createdAt: -1 });

//         if (!requests || requests.length === 0) {
//             console.log("No history service requests found");
//             return res.status(200).json(
//                 ApiResponse.success("No history service requests found", [])
//             );
//         }

//         const response = requests.map((request) => ({
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

//             customerLocation: request.customerLocation?.location?.coordinates
//                 ? {
//                     latitude: request.customerLocation.location.coordinates[1],
//                     longitude: request.customerLocation.location.coordinates[0],
//                     address: request.customerLocation.address
//                 }
//                 : null,

//             mechanicLocation: request.mechanicLocation?.location?.coordinates
//                 ? {
//                     latitude: request.mechanicLocation.location.coordinates[1],
//                     longitude: request.mechanicLocation.location.coordinates[0],
//                     address: request.mechanicLocation.address
//                 }
//                 : null,

//             createdAt: request.createdAt
//         }));

//         console.log("History service requests fetched successfully");

//         return res.status(200).json(
//             ApiResponse.success("History service requests fetched successfully", response)
//         );

//     } catch (err) {

//         console.error(err);

//         return res.status(500).json(
//             ApiResponse.error("Server error", 500)
//         );
//     }
// });


router.post("/getShopServiceRequests", async (req, res) => {
    console.log("-----API Get Available Service Requests (Filtered)-----");

    try {
        const { shopId, mechanicId } = req.body;

        if (!shopId || !mechanicId) {
            console.log("shopId and mechanicId are required", req.body);
            return res.status(400).json(
                ApiResponse.error("shopId and mechanicId are required", 400)
            );
        }

        const requests = await ServiceRequest.find({
            shopId: shopId,
            status: "requested",
            rejectedBy: { $ne: mechanicId }
        }).sort({ createdAt: -1 }).lean();

        const response = await Promise.all(
            requests.map(async (request) => {
                const shop = await Shop.findById(request.shopId).select("shopName supportedVehicles");
                const service = await Services.findById(request.serviceId).select("service");
                const customer = await Customer.findById(request.customerId).select("name");

                return {
                    _id: request._id,
                    customerId: request.customerId,
                    customerName: customer ? customer.name : "",
                    shopId: request.shopId,
                    shopName: shop ? shop.shopName : "",
                    mechanicId: request.mechanicId,
                    vehicleId: request.vehicleId,
                    serviceId: request.serviceId,
                    serviceName: service ? service.service : "",
                    problemDescription: request.problemDescription,
                    status: request.status,
                    totalPrice: request.totalPrice,
                    totalDistance: request.totalDistance,
                    totalDuration: request.totalDuration,
                    paymentStatus: request.paymentStatus,
                    requestImages: request.requestImages,

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
            })
        );

        console.log("Service requests fetched successfully", response);
        return res.status(200).json(
            ApiResponse.success("Service requests fetched successfully", response)
        );

    } catch (err) {
        console.error(err);
        return res.status(500).json(ApiResponse.error("Server error", 500));
    }
});



// ================= Get Accepted Service Request =================
router.post("/getAcceptedServiceRequest", async (req, res) => {

    console.log("-----API Get Accepted Service Request-----");

    try {

        const { id } = req.body;

        /*
         * VALIDATION
         */
        if (!id) {

            console.log(
                "Request Id is required",
                req.body
            );

            return res.status(400).json(

                ApiResponse.error(
                    "Request ID is required",
                    400
                )
            );
        }

        /*
         * FIND REQUEST
         */
        const request =
            await ServiceRequest.findById(id);

        if (!request) {

            console.log(
                "Service request not found",
                req.body
            );

            return res.status(404).json(

                ApiResponse.error(
                    "Service request not found",
                    404
                )
            );
        }

        /*
         * GET RELATED DATA
         */
        const shop =
            await Shop.findById(
                request.shopId
            ).select(
                "shopName supportedVehicles"
            );

        const service =
            await Services.findById(
                request.serviceId
            ).select(
                "service description price"
            );

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

        /*
         * RESPONSE
         */
        const response = {

            _id:
                request._id,

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

            shopId:
                request.shopId,

            shopName:
                shop
                    ? shop.shopName
                    : "",

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

            vehicleId:
                request.vehicleId,

            serviceId:
                request.serviceId,

            /*
             * SERVICE DETAILS
             */
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

            supportedVehicles:
                shop?.supportedVehicles || [],

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

            isSOS: request.isSOS,

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
                request.mechanicLocation
                    ?.location
                    ?.coordinates

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

        console.log(
            "Accepted service request fetched successfully",
            response
        );

        return res.status(200).json(

            ApiResponse.success(
                "Service request fetched successfully",
                response
            )
        );

    } catch (err) {

        console.error(err);

        return res.status(500).json(

            ApiResponse.error(
                "Server error",
                500
            )
        );
    }
});


// // ================= Get Accepted Service Request =================
// router.post("/getAcceptedServiceRequest", async (req, res) => {
//     console.log("-----API Get Service Request By ID-----");

//     try {
//         const { id } = req.body;

//         if (!id) {
//             console.log("Request Id are required", req.body);
//             return res.status(400).json(
//                 ApiResponse.error("Request ID is required", 400)
//             );
//         }

//         const request = await ServiceRequest.findById(id);

//         if (!request) {
//             console.log("Service request not found", req.body);
//             return res.status(404).json(
//                 ApiResponse.error("Service request not found", 404)
//             );
//         }

//         const shop = await Shop.findById(request.shopId).select("shopName supportedVehicles");
//         const service = await Services.findById(request.serviceId).select("service");
//         const customer = await Customer.findById(request.customerId).select("name");

//         const response = {
//             _id: request._id,
//             customerId: request.customerId,
//             customerName: customer ? customer.name : "",
//             shopId: request.shopId,
//             shopName: shop ? shop.shopName : "",
//             mechanicId: request.mechanicId,
//             vehicleId: request.vehicleId,
//             serviceId: request.serviceId,
//             serviceName: service ? service.service : "",
//             problemDescription: request.problemDescription,
//             status: request.status,
//             totalPrice: request.totalPrice,
//             totalDistance: request.totalDistance,
//             totalDuration: request.totalDuration,
//             paymentStatus: request.paymentStatus,

//             customerLocation: request.customerLocation
//                 ? {
//                     latitude: request.customerLocation.location.coordinates[1],
//                     longitude: request.customerLocation.location.coordinates[0],
//                     address: request.customerLocation.address
//                 }
//                 : null,

//             mechanicLocation: request.mechanicLocation?.location?.coordinates
//                 ? {
//                     latitude: request.mechanicLocation.location.coordinates[1],
//                     longitude: request.mechanicLocation.location.coordinates[0],
//                     address: request.mechanicLocation.address
//                 }
//                 : null,

//             createdAt: request.createdAt
//         };

//         console.log("Service request fetched successfully", response);
//         return res.status(200).json(
//             ApiResponse.success("Service request fetched successfully", response)
//         );

//     } catch (err) {
//         console.error(err);
//         return res.status(500).json(ApiResponse.error("Server error", 500));
//     }
// });



// ================= Get Active Service Requests =================
router.post("/getActiveServiceRequests", async (req, res) => {

    console.log(
        "-----API Get Active Service Requests By ShopId & MechanicId-----"
    );

    try {

        const {
            mechanicId,
            shopId
        } = req.body;

        /*
         * VALIDATION
         */
        if (!shopId || !mechanicId) {

            console.log(
                "shopId and mechanicId are required",
                req.body
            );

            return res.status(400).json(

                ApiResponse.error(
                    "Shop ID and Mechanic ID are required",
                    400
                )
            );
        }

        /*
         * FETCH ACTIVE REQUESTS
         */
        const requests =
            await ServiceRequest.find({

                mechanicId: mechanicId,

                isActive: true,

                $or: [

                    { shopId: shopId },

                    { isSOS: true }
                ]
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
                        "service description price"
                })

                /*
                 * CUSTOMER DETAILS
                 */
                .populate({

                    path: "customerId",

                    select:
                        "name profileImage phoneNumber"
                })

                /*
                 * MECHANIC DETAILS
                 */
                .populate({

                    path: "mechanicId",

                    select:
                        "name profileImage"
                })

                .sort({
                    createdAt: -1
                });

        /*
         * EMPTY RESPONSE
         */
        if (!requests.length) {

            console.log(
                "No active service requests found",
                req.body
            );

            return res.status(200).json(

                ApiResponse.success(

                    "No active service requests found",

                    []
                )
            );
        }

        /*
         * FORMAT RESPONSE
         */
        const response =
            requests.map(request => ({

                _id:
                    request._id,

                /*
                 * CUSTOMER
                 */
                customerId:
                    request.customerId?._id || null,

                customerName:
                    request.customerId?.name || "",

                customerProfile:
                    request.customerId?.profileImage || "",

                customerPhone:
                    request.customerId?.phoneNumber || "",

                /*
                 * SHOP
                 */
                shopId:
                    request.shopId?._id || null,

                shopName:
                    request.shopId?.shopName || "",

                supportedVehicles:
                    request.shopId?.supportedVehicles || [],

                /*
                 * MECHANIC
                 */
                mechanicId:
                    request.mechanicId?._id || null,

                mechanicName:
                    request.mechanicId?.name || "",

                mechanicProfile:
                    request.mechanicId?.profileImage || "",

                /*
                 * VEHICLE
                 */
                vehicleId:
                    request.vehicleId,

                /*
                 * SERVICE
                 */
                serviceId:
                    request.serviceId?._id || null,

                serviceName:
                    request.serviceId?.service || "",

                serviceDescription:
                    request.serviceId?.description || "",

                servicePrice:
                    request.serviceId?.price || 0,

                /*
                 * REQUEST
                 */
                problemDescription:
                    request.problemDescription,

                status:
                    request.status,

                isActive:
                    request.isActive,

                isSOS:
                    request.isSOS,

                totalPrice:
                    request.totalPrice,

                totalDistance:
                    request.totalDistance,

                totalDuration:
                    request.totalDuration,

                paymentStatus:
                    request.paymentStatus,

                /*
                 * REQUEST IMAGES
                 */
                requestImages:
                    request.requestImages || [],

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
        console.log(
            "Active service requests fetched successfully"
        );

        return res.status(200).json(

            ApiResponse.success(

                "Active service requests fetched successfully",

                response
            )
        );

    } catch (err) {

        console.error(
            "GET ACTIVE REQUEST ERROR"
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


// // ================= Get Active Service Requests =================
// router.post("/getActiveServiceRequests", async (req, res) => {
//     console.log("-----API Get Active Service Requests By ShopId & MechanicId-----");

//     try {
//         const { mechanicId, shopId } = req.body;

//         if (!shopId || !mechanicId) {
//             console.log("shopId and mechanicId are required", req.body);
//             return res.status(400).json(
//                 ApiResponse.error("Shop ID and Mechanic ID are required", 400)
//             );
//         }

//         const requests = await ServiceRequest.find({
//             mechanicId: mechanicId,
//             isActive: true,
//             $or: [{ shopId: shopId }, { isSOS: true }]
//         }).sort({ createdAt: -1 });

//         if (!requests.length) {
//             console.log("No active service requests found", req.body);
//             return res.status(200).json(
//                 ApiResponse.success("No active service requests found", [])
//             );
//         }

//         const response = await Promise.all(
//             requests.map(async (request) => {
//                 const shop = await Shop.findById(request.shopId).select("shopName supportedVehicles");
//                 const service = await Services.findById(request.serviceId).select("service");
//                 const customer = await Customer.findById(request.customerId).select("name");

//                 return {
//                     _id: request._id,
//                     customerId: request.customerId,
//                     customerName: customer ? customer.name : "",
//                     shopId: request.shopId,
//                     shopName: shop ? shop.shopName : "",
//                     mechanicId: request.mechanicId,
//                     vehicleId: request.vehicleId,
//                     serviceId: request.serviceId,
//                     serviceName: service ? service.service : "",
//                     problemDescription: request.problemDescription,
//                     status: request.status,
//                     isActive: request.isActive,
//                     isSOS: request.isSOS,
//                     totalPrice: request.totalPrice,
//                     totalDistance: request.totalDistance,
//                     totalDuration: request.totalDuration,
//                     paymentStatus: request.paymentStatus,

//                     customerLocation: request.customerLocation?.location?.coordinates
//                         ? {
//                             latitude: request.customerLocation.location.coordinates[1],
//                             longitude: request.customerLocation.location.coordinates[0],
//                             address: request.customerLocation.address
//                         }
//                         : null,

//                     mechanicLocation: request.mechanicLocation?.location?.coordinates
//                         ? {
//                             latitude: request.mechanicLocation.location.coordinates[1],
//                             longitude: request.mechanicLocation.location.coordinates[0],
//                             address: request.mechanicLocation.address
//                         }
//                         : null,

//                     createdAt: request.createdAt
//                 };
//             })
//         );

//         console.log("Active service requests fetched successfully", response);
//         return res.status(200).json(
//             ApiResponse.success("Active service requests fetched successfully", response)
//         );

//     } catch (err) {
//         console.error(err);
//         return res.status(500).json(ApiResponse.error("Server error", 500));
//     }
// });



// ================= Get Shop History Service Requests =================
router.post("/getShopHistoryServiceRequests", async (req, res) => {

    console.log(
        "-----API Get History Service Requests By ShopId-----"
    );

    try {

        const { id } = req.body;

        /*
         * VALIDATION
         */
        if (!id) {

            console.log(
                "shopId are required",
                req.body
            );

            return res.status(400).json(

                ApiResponse.error(
                    "Shop ID are required",
                    400
                )
            );
        }

        /*
         * FETCH HISTORY REQUESTS
         */
        const requests =
            await ServiceRequest.find({

                shopId: id,

                status: {
                    $in: [

                        "completed",

                        "cancelled"
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
                        "service description price"
                })

                /*
                 * CUSTOMER DETAILS
                 */
                .populate({

                    path: "customerId",

                    select:
                        "name profileImage phoneNumber"
                })

                /*
                 * MECHANIC DETAILS
                 */
                .populate({

                    path: "mechanicId",

                    select:
                        "name profileImage"
                })

                .sort({
                    createdAt: -1
                });

        /*
         * EMPTY RESPONSE
         */
        if (!requests.length) {

            return res.status(200).json(

                ApiResponse.success(

                    "No history service requests found",

                    []
                )
            );
        }

        /*
         * FORMAT RESPONSE
         */
        const response =
            requests.map(request => ({

                _id:
                    request._id,

                /*
                 * CUSTOMER
                 */
                customerId:
                    request.customerId?._id || null,

                customerName:
                    request.customerId?.name || "",

                customerProfile:
                    request.customerId?.profileImage || "",

                customerPhone:
                    request.customerId?.phoneNumber || "",

                /*
                 * SHOP
                 */
                shopId:
                    request.shopId?._id || null,

                shopName:
                    request.shopId?.shopName || "",

                supportedVehicles:
                    request.shopId?.supportedVehicles || [],

                /*
                 * MECHANIC
                 */
                mechanicId:
                    request.mechanicId?._id || null,

                mechanicName:
                    request.mechanicId?.name || "",

                mechanicProfile:
                    request.mechanicId?.profileImage || "",

                /*
                 * VEHICLE
                 */
                vehicleId:
                    request.vehicleId,

                /*
                 * SERVICE
                 */
                serviceId:
                    request.serviceId?._id || null,

                serviceName:
                    request.serviceId?.service || "",

                serviceDescription:
                    request.serviceId?.description || "",

                servicePrice:
                    request.serviceId?.price || 0,

                /*
                 * REQUEST
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
                 * REQUEST IMAGES
                 */
                requestImages:
                    request.requestImages || [],

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
        console.log(
            "History service fetched successfully"
        );

        return res.status(200).json(

            ApiResponse.success(

                "History service requests fetched successfully",

                response
            )
        );

    } catch (err) {

        console.error(
            "GET HISTORY REQUEST ERROR"
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



// // ================= Get Shop History Service Requests =================
// router.post("/getShopHistoryServiceRequests", async (req, res) => {
//     console.log("-----API Get History Service Requests By ShopId-----");

//     try {
//         const { id } = req.body;

//         if (!id) {
//             console.log("shopId are required", req.body);
//             return res.status(400).json(
//                 ApiResponse.error("Shop ID are required", 400)
//             );
//         }

//         const requests = await ServiceRequest.find({
//             shopId: id,
//             status: { $in: ["completed", "cancelled"] }
//         }).sort({ createdAt: -1 });

//         const response = await Promise.all(
//             requests.map(async (request) => {
//                 const shop = await Shop.findById(request.shopId).select("shopName supportedVehicles");
//                 const service = await Services.findById(request.serviceId).select("service");
//                 const customer = await Customer.findById(request.customerId).select("name");

//                 return {
//                     _id: request._id,
//                     customerId: request.customerId,
//                     customerName: customer ? customer.name : "",
//                     shopId: request.shopId,
//                     shopName: shop ? shop.shopName : "",
//                     mechanicId: request.mechanicId,
//                     vehicleId: request.vehicleId,
//                     serviceId: request.serviceId,
//                     serviceName: service ? service.service : "",
//                     problemDescription: request.problemDescription,
//                     status: request.status,
//                     totalPrice: request.totalPrice,
//                     totalDistance: request.totalDistance,
//                     totalDuration: request.totalDuration,
//                     paymentStatus: request.paymentStatus,
//                     createdAt: request.createdAt
//                 };
//             })
//         );

//         console.log("History service fetched successfully", response);
//         return res.status(200).json(
//             ApiResponse.success("History service requests fetched successfully", response)
//         );

//     } catch (err) {
//         console.error(err);
//         return res.status(500).json(ApiResponse.error("Server error", 500));
//     }
// });




// ================= Get Worker History Service Requests =================
router.post("/getWorkerHistoryServiceRequests", async (req, res) => {

    console.log(
        "-----API Get Worker History Service Requests-----"
    );

    try {

        const {
            mechanicId,
            shopId
        } = req.body;

        /*
         * VALIDATION
         */
        if (!shopId || !mechanicId) {

            console.log(
                "shopId and mechanicId are required",
                req.body
            );

            return res.status(400).json(

                ApiResponse.error(

                    "Shop ID and Mechanic ID are required",

                    400
                )
            );
        }

        /*
         * FETCH HISTORY REQUESTS
         */
        const requests =
            await ServiceRequest.find({

                shopId: shopId,

                mechanicId: mechanicId,

                status: {

                    $in: [

                        "completed",

                        "cancelled"
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
                        "service description price"
                })

                /*
                 * CUSTOMER DETAILS
                 */
                .populate({

                    path: "customerId",

                    select:
                        "name profileImage phoneNumber"
                })

                /*
                 * MECHANIC DETAILS
                 */
                .populate({

                    path: "mechanicId",

                    select:
                        "name profileImage"
                })

                .sort({
                    createdAt: -1
                });

        /*
         * EMPTY RESPONSE
         */
        if (!requests.length) {

            return res.status(200).json(

                ApiResponse.success(

                    "No worker history requests found",

                    []
                )
            );
        }

        /*
         * FORMAT RESPONSE
         */
        const response =
            requests.map(request => ({

                _id:
                    request._id,

                /*
                 * CUSTOMER
                 */
                customerId:
                    request.customerId?._id || null,

                customerName:
                    request.customerId?.name || "",

                customerProfile:
                    request.customerId?.profileImage || "",

                customerPhone:
                    request.customerId?.phoneNumber || "",

                /*
                 * SHOP
                 */
                shopId:
                    request.shopId?._id || null,

                shopName:
                    request.shopId?.shopName || "",

                supportedVehicles:
                    request.shopId?.supportedVehicles || [],

                /*
                 * MECHANIC
                 */
                mechanicId:
                    request.mechanicId?._id || null,

                mechanicName:
                    request.mechanicId?.name || "",

                mechanicProfile:
                    request.mechanicId?.profileImage || "",

                /*
                 * VEHICLE
                 */
                vehicleId:
                    request.vehicleId,

                /*
                 * SERVICE
                 */
                serviceId:
                    request.serviceId?._id || null,

                serviceName:
                    request.serviceId?.service || "",

                serviceDescription:
                    request.serviceId?.description || "",

                servicePrice:
                    request.serviceId?.price || 0,

                /*
                 * REQUEST
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
                 * REQUEST IMAGES
                 */
                requestImages:
                    request.requestImages || [],

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
        console.log(
            "History service requests fetched successfully"
        );

        return res.status(200).json(

            ApiResponse.success(

                "History service requests fetched successfully",

                response
            )
        );

    } catch (err) {

        console.error(
            "GET WORKER HISTORY REQUEST ERROR"
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



// // ================= Get Worker History Service Requests =================
// router.post("/getWorkerHistoryServiceRequests", async (req, res) => {
//     console.log("-----API Get Worker History Service Requests-----");

//     try {
//         const { mechanicId, shopId } = req.body;

//         if (!shopId || !mechanicId) {
//             console.log("shopId and mechanicId are required", req.body);
//             return res.status(400).json(
//                 ApiResponse.error("Shop ID and Mechanic ID are required", 400)
//             );
//         }

//         const requests = await ServiceRequest.find({
//             shopId: shopId,
//             mechanicId: mechanicId,
//             status: { $in: ["completed", "cancelled"] }
//         }).sort({ createdAt: -1 });

//         const response = await Promise.all(
//             requests.map(async (request) => {
//                 const shop = await Shop.findById(request.shopId).select("shopName supportedVehicles");
//                 const service = await Services.findById(request.serviceId).select("service");
//                 const customer = await Customer.findById(request.customerId).select("name");

//                 return {
//                     _id: request._id,
//                     customerId: request.customerId,
//                     customerName: customer ? customer.name : "",
//                     shopId: request.shopId,
//                     shopName: shop ? shop.shopName : "",
//                     mechanicId: request.mechanicId,
//                     vehicleId: request.vehicleId,
//                     serviceId: request.serviceId,
//                     serviceName: service ? service.service : "",
//                     problemDescription: request.problemDescription,
//                     status: request.status,
//                     totalPrice: request.totalPrice,
//                     totalDistance: request.totalDistance,
//                     totalDuration: request.totalDuration,
//                     paymentStatus: request.paymentStatus,
//                     createdAt: request.createdAt
//                 };
//             })
//         );

//         console.log("History service requests fetched successfully", response);
//         return res.status(200).json(
//             ApiResponse.success("History service requests fetched successfully", response)
//         );

//     } catch (err) {
//         console.error(err);
//         return res.status(500).json(ApiResponse.error("Server error", 500));
//     }
// });


// ==================== Get User Data ==========================
router.post("/getUserData", async (req, res) => {
    console.log("-----API Mechanic User Data Get-----");
    try {
        const { uid } = req.body.uid;

        if (!uid) {
            console.log("Error in user data fetch");
            res.status(400).json(
                ApiResponse.error("Invalid uid", 400)
            );
        }

        const existingUser = await Mechanic.findOne({ uid });

        if (!existingUser) {
            console.log("Error in user data fetch");
            res.status(400).json(
                ApiResponse.error("Invalid uid", 400)
            );
        }

        console.log("User data is fetched successfully");
        res.sendStatus(200).json(
            ApiResponse.success("User data is fetched",
                {
                    id: existingUser.uid,
                    name: existingUser.name,
                    phoneNumber: existingUser.phoneNumber,
                    address: existingUser.address
                }
            )
        )
    } catch (err) {
        console.error(err);
        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});


// router.post("/acceptServiceRequest", async (req, res) => {

//     console.log("-----API Mechanic Accept Service Request-----");

//     try {

//         const {
//             requestId,
//             mechanicId,
//             mechanicLocation
//         } = req.body;

//         const address = mechanicLocation?.address;
//         const latitude = mechanicLocation?.latitude;
//         const longitude = mechanicLocation?.longitude;

//         // ✅ Validation
//         if (
//             !requestId ||
//             !mechanicId ||
//             !address ||
//             latitude === undefined ||
//             longitude === undefined
//         ) {
//             return res.status(400).json(
//                 ApiResponse.error("Missing required fields", 400)
//             );
//         }

//         // ✅ 🔥 ATOMIC UPDATE (IMPORTANT)
//         const request = await ServiceRequest.findOneAndUpdate(
//             {
//                 _id: requestId,
//                 status: "requested",
//                 mechanicId: null
//             },
//             {
//                 mechanicId,
//                 status: "accepted",
//                 mechanicLocation: {
//                     address,
//                     location: {
//                         type: "Point",
//                         coordinates: [
//                             parseFloat(longitude),
//                             parseFloat(latitude)
//                         ]
//                     }
//                 },
//                 isActive: true
//             },
//             { new: true } // better than returnDocument
//         );

//         // ❌ If already accepted
//         if (!request) {
//             return res.status(400).json(
//                 ApiResponse.error(
//                     "Request already accepted by another mechanic",
//                     400
//                 )
//             );
//         }

//         // ================= SEND FCM =================

//         const customer = await Customer.findById(request.customerId);

//         if (customer?.fcmToken) {

//             const message = {
//                 token: customer.fcmToken,
//                 notification: {
//                     title: "Mechanic accepted your request 🚗",
//                     body: "Go and talk with mechanic if any doubt"
//                 },
//                 data: {
//                     serviceId: request._id.toString(),
//                     requestStatus: request.status,
//                     type: "SERVICE_REQUEST"
//                 }
//             };

//             await admin.messaging().send(message);

//             console.log("Notification sent to customer");
//         }

//         // ================= RESPONSE =================

//         const response = {
//             _id: request._id,
//             customerId: request.customerId,
//             shopId: request.shopId,
//             mechanicId: request.mechanicId,
//             vehicleId: request.vehicleId,
//             serviceId: request.serviceId,
//             problemDescription: request.problemDescription,
//             totalPrice: request.totalPrice,
//             totalDistance: request.totalDistance,
//             totalDuration: request.totalDuration,
//             status: request.status,
//             paymentStatus: request.paymentStatus,

//             customerLocation: request.customerLocation
//                 ? {
//                     latitude: request.customerLocation.location.coordinates[1],
//                     longitude: request.customerLocation.location.coordinates[0],
//                     address: request.customerLocation.address
//                 }
//                 : null,

//             mechanicLocation: {
//                 latitude: request.mechanicLocation.location.coordinates[1],
//                 longitude: request.mechanicLocation.location.coordinates[0],
//                 address: request.mechanicLocation.address
//             },

//             createdAt: request.createdAt
//         };

//         console.log("Request accepted successfully");

//         return res.status(200).json(
//             ApiResponse.success("Request accepted successfully", response)
//         );

//     } catch (err) {

//         console.error(err);

//         return res.status(500).json(
//             ApiResponse.error("Server error", 500)
//         );
//     }
// });


// // ================= Mechanic Cancel Request =================
// router.post("/cancelServiceRequest", async (req, res) => {

//     console.log("-----API Mechanic Cancel Service Request-----");

//     try {

//         const { id } = req.body;
//         const requestId = id;

//         if (!requestId) {
//             console.log("Request ID is required", req.body);
//             return res.status(400).json(
//                 ApiResponse.error("Request ID is required", 400)
//             );
//         }

//         const request = await ServiceRequest.findByIdAndUpdate(
//             requestId,
//             {
//                 status: "cancelled",
//                 mechanicId: null,
//                 mechanicLocation: null
//             },
//             { returnDocument: 'after' }
//         );

//         if (!request) {
//             console.log("Request not found");
//             return res.status(404).json(
//                 ApiResponse.error("Request not found", 404)
//             );
//         }

//         // ================= SEND FCM NOTIFICATION =================

//         const customer = await Customer.findById(request.customerId);

//         if (customer?.fcmToken) {

//             const message = {
//                 token: customer.fcmToken,

//                 notification: {
//                     title: "Mechanic cancelled your request",
//                     body: "Go and try to reach another mechanic shop"
//                 },

//                 data: {
//                     title: "Mechanic cancelled your request",
//                     body: "Go and try to reach another mechanic shop",
//                     serviceId: request._id.toString(),
//                     requestStatus: request.status,
//                     type: "SERVICE_REQUEST"
//                 }
//             };

//             await admin.messaging().send(message);
//             console.log("Notification sent to customer");
//         }

//         // =========================================================

//         // ✅ Helper function to safely format location
//         const formatLocation = (loc) => {
//             if (!loc?.location?.coordinates || loc.location.coordinates.length < 2) {
//                 return null;
//             }

//             return {
//                 latitude: loc.location.coordinates[1],
//                 longitude: loc.location.coordinates[0],
//                 address: loc.address || null
//             };
//         };

//         // Format response for Android
//         const response = {
//             _id: request._id,
//             customerId: request.customerId,
//             shopId: request.shopId,
//             mechanicId: request.mechanicId,
//             vehicleId: request.vehicleId,
//             serviceId: request.serviceId,
//             problemDescription: request.problemDescription,
//             totalPrice: request.totalPrice,
//             totalDistance: request.totalDistance,
//             totalDuration: request.totalDuration,
//             status: request.status,
//             paymentStatus: request.paymentStatus,

//             customerLocation: formatLocation(request.customerLocation),
//             mechanicLocation: formatLocation(request.mechanicLocation),

//             createdAt: request.createdAt
//         };

//         console.log("Request cancelled successfully", response);

//         return res.status(200).json(
//             ApiResponse.success("Service request cancelled successfully", response)
//         );

//     } catch (err) {

//         console.error("Cancel Service Error:", err);

//         return res.status(500).json(
//             ApiResponse.error("Server error", 500)
//         );
//     }
// });




// router.post("/acceptServiceRequest", async (req, res) => {

//     console.log("-----API Mechanic Accept Service Request-----");

//     try {

//         const { requestId, mechanicId, mechanicLocation } = req.body;

//         const address = mechanicLocation?.address;
//         const latitude = mechanicLocation?.latitude;
//         const longitude = mechanicLocation?.longitude;

//         if (
//             !requestId ||
//             !mechanicId ||
//             !address ||
//             latitude === undefined ||
//             longitude === undefined
//         ) {
//             return res.status(400).json(
//                 ApiResponse.error("Missing required fields", 400)
//             );
//         }

//         // ✅ ATOMIC UPDATE
//         const request = await ServiceRequest.findOneAndUpdate(
//             {
//                 _id: requestId,
//                 status: "requested"
//             },
//             {
//                 mechanicId,
//                 status: "accepted",
//                 mechanicLocation: {
//                     address,
//                     location: {
//                         type: "Point",
//                         coordinates: [
//                             parseFloat(longitude),
//                             parseFloat(latitude)
//                         ]
//                     }
//                 },
//                 isActive: true
//             },
//             { returnDocument: 'after' }
//         );

//         if (!request) {
//             return res.status(400).json(
//                 ApiResponse.error("Already accepted by another mechanic", 400)
//             );
//         }

//         // ================= SOS EMIT FIX =================

//         console.log("🔥 isSOS value:", request.isSOS);

//         // ✅ SAFE CHECK
//         if (request.isSOS) {

//             const customerId = request.customerId.toString();

//             console.log("🚨 Sending SOS ACCEPT to:", customerId);

//             emitSOSAccepted(customerId, {
//                 requestId: request._id.toString()
//             });
//         }

//         // 🔥 SOCKET: REMOVE FROM OTHERS
//         emitRemoveRequest(request.shopId, request._id);

//         // 🔔 Notify customer
//         const customer = await Customer.findById(request.customerId);

//         if (customer?.fcmToken) {
//             await admin.messaging().send({
//                 token: customer.fcmToken,
//                 notification: {
//                     title: "Mechanic accepted your request 🚗",
//                     body: "Go and talk with mechanic if any doubt"
//                 }
//             });
//         }

//         // ================= FORMAT RESPONSE =================

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

//             customerLocation: request.customerLocation?.location?.coordinates
//                 ? {
//                     latitude: request.customerLocation.location.coordinates[1],
//                     longitude: request.customerLocation.location.coordinates[0],
//                     address: request.customerLocation.address
//                 }
//                 : null,

//             mechanicLocation: request.mechanicLocation?.location?.coordinates
//                 ? {
//                     latitude: request.mechanicLocation.location.coordinates[1],
//                     longitude: request.mechanicLocation.location.coordinates[0],
//                     address: request.mechanicLocation.address
//                 }
//                 : null,

//             createdAt: request.createdAt
//         };

//         // ===================================================

//         return res.status(200).json(
//             ApiResponse.success("Request accepted successfully", response)
//         );

//     } catch (err) {

//         console.error(err);

//         return res.status(500).json(
//             ApiResponse.error("Server error", 500)
//         );
//     }
// });


router.post("/acceptServiceRequest", async (req, res) => {

    console.log("-----API Mechanic Accept Service Request-----");

    try {

        const { requestId, mechanicId, mechanicLocation } = req.body;

        const address = mechanicLocation?.address;
        const latitude = mechanicLocation?.latitude;
        const longitude = mechanicLocation?.longitude;

        if (
            !requestId ||
            !mechanicId ||
            !address ||
            latitude === undefined ||
            longitude === undefined
        ) {
            return res.status(400).json(
                ApiResponse.error("Missing required fields", 400)
            );
        }

        // ==========================================
        // FIND MECHANIC SHOP (for SOS requests)
        // ==========================================

        const mechanicShop = await Shop.findOne({
            $or: [
                { ownerId: mechanicId },
                { workers: mechanicId }
            ]
        });

        // ==========================================
        // BUILD UPDATE DATA
        // ==========================================

        const updateData = {
            mechanicId,
            status: "accepted",
            mechanicLocation: {
                address,
                location: {
                    type: "Point",
                    coordinates: [
                        parseFloat(longitude),
                        parseFloat(latitude)
                    ]
                }
            },
            isActive: true
        };

        // If mechanic belongs to shop, save shopId
        if (mechanicShop) {
            updateData.shopId = mechanicShop._id;
        }

        // ==========================================
        // ATOMIC UPDATE
        // ==========================================

        const request = await ServiceRequest.findOneAndUpdate(
            {
                _id: requestId,
                status: "requested"
            },
            updateData,
            { returnDocument: "after" }
        );

        if (!request) {
            return res.status(400).json(
                ApiResponse.error("Already accepted by another mechanic", 400)
            );
        }

        // ==========================================
        // SOS ACCEPT EMIT
        // ==========================================

        if (request.isSOS) {

            const customerId = request.customerId.toString();

            emitSOSAccepted(customerId, {
                requestId: request._id.toString()
            });
        }

        // ==========================================
        // REMOVE FROM OTHER MECHANICS
        // ==========================================

        if (request.isSOS) {

            // remove from all shops who received SOS
            if (request.sentShopIds?.length) {
                request.sentShopIds.forEach(shopId => {
                    emitRemoveRequest(shopId, request._id);
                });
            }

        } else {

            emitRemoveRequest(request.shopId, request._id);
        }

        // ==========================================
        // NOTIFY CUSTOMER
        // ==========================================

        const customer = await Customer.findById(request.customerId);

        if (customer?.fcmToken) {
            await admin.messaging().send({
                token: customer.fcmToken,
                notification: {
                    title: "Mechanic accepted your request 🚗",
                    body: "Go and talk with mechanic if any doubt"
                }
            });
        }

        // ==========================================
        // RESPONSE
        // ==========================================

        const response = {
            _id: request._id,
            customerId: request.customerId,
            shopId: request.shopId,
            mechanicId: request.mechanicId,
            vehicleId: request.vehicleId,
            serviceId: request.serviceId,
            problemDescription: request.problemDescription,
            status: request.status,
            totalPrice: request.totalPrice,
            totalDistance: request.totalDistance,
            totalDuration: request.totalDuration,
            paymentStatus: request.paymentStatus,

            customerLocation:
                request.customerLocation?.location?.coordinates
                    ? {
                        latitude:
                            request.customerLocation.location.coordinates[1],
                        longitude:
                            request.customerLocation.location.coordinates[0],
                        address: request.customerLocation.address
                    }
                    : null,

            mechanicLocation:
                request.mechanicLocation?.location?.coordinates
                    ? {
                        latitude:
                            request.mechanicLocation.location.coordinates[1],
                        longitude:
                            request.mechanicLocation.location.coordinates[0],
                        address: request.mechanicLocation.address
                    }
                    : null,

            createdAt: request.createdAt
        };

        return res.status(200).json(
            ApiResponse.success(
                "Request accepted successfully",
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



router.post("/cancelServiceRequest", async (req, res) => {

    console.log("-----API Mechanic Reject Service Request-----");

    try {

        const { requestId, mechanicId } = req.body;

        if (!requestId || !mechanicId) {
            console.log("requestId and mechanicId are required", req.body);
            return res.status(400).json(
                ApiResponse.error("requestId and mechanicId are required", 400)
            );
        }

        // ✅ Add mechanic to rejected list
        const request = await ServiceRequest.findByIdAndUpdate(
            requestId,
            {
                $addToSet: { rejectedBy: mechanicId }
            },
            { new: true }
        );

        if (!request) {
            console.log("requestId and mechanicId are required", req.body);
            return res.status(404).json(
                ApiResponse.error("Request not found", 404)
            );
        }

        // ❌ NO SOCKET EMIT HERE (IMPORTANT)

        console.log("Request Rejected by the mechanic", " mechanicId || requestId ");
        return res.status(200).json(
            ApiResponse.success("Request rejected successfully", {
                requestId: request._id,
                rejectedBy: request.rejectedBy
            })
        );

    } catch (err) {

        console.error("Reject Service Error:", err);

        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});




// ================= Mechanic Start Service (Using requestId only) =================
router.post("/startServiceRequest", async (req, res) => {

    console.log("-----API Mechanic Start Service Request-----");

    try {

        const { id } = req.body;
        const requestId = id;

        if (!requestId) {
            console.log("RequestId is required", req.body);
            return res.status(400).json(
                ApiResponse.error("requestId is required", 400)
            );
        }

        const request = await ServiceRequest.findById(requestId);

        if (!request) {
            console.log("Request not found");
            return res.status(404).json(
                ApiResponse.error("Request not found", 404)
            );
        }

        if (request.status !== "accepted") {
            console.log("Only accepted requests can be started", request);
            return res.status(400).json(
                ApiResponse.error("Only accepted requests can be started", 400)
            );
        }

        if (!request.mechanicId) {
            console.log("No mechanic assigned to this request", request);
            return res.status(400).json(
                ApiResponse.error("No mechanic assigned to this request", 400)
            );
        }

        request.status = "in_progress";

        emitOrderStatusUpdate(request._id.toString(), {

            orderId: request._id.toString(),

            status: request.status
        });
        await request.save();

        console.log("Service moved to in_progress:", request._id);

        // // ================= SEND FCM NOTIFICATION =================

        // try {

        //     const customer = await Customer.findById(request.customerId);

        //     if (customer?.fcmToken) {
        //         await admin.messaging().send({
        //             token: customer.fcmToken,
        //             notification: {
        //                 title: "Service Started 🚗",
        //                 body: "Mechanic has started working on your request"
        //             },
        //             data: {
        //                 serviceId: request._id.toString(),
        //                 requestStatus: request.status,
        //                 type: "SERVICE_REQUEST"
        //             }
        //         });

        //         console.log("Notification sent to customer");
        //     }

        // } catch (notifyErr) {
        //     console.error("Notification error:", notifyErr);
        // }

        return res.status(200).json(
            ApiResponse.success("Service started successfully", {
                _id: request._id,
                status: request.status
            })
        );

    } catch (err) {

        console.error(err);

        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});



// ================= Mechanic Complete Service =================
router.post("/completeServiceRequest", async (req, res) => {
    console.log("-----API Mechanic Complete Service Request-----");

    try {

        const { id } = req.body;
        const requestId = id;

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

        if (request.status !== "in_progress" && request.status !== "accepted") {
            console.log("Invalid status transition", request);
            return res.status(400).json(
                ApiResponse.error("Invalid status transition", 400)
            );
        }

        const now = new Date();
        const timeoutMinutes = 10;

        request.status = "waiting_for_confirmation";
        request.completionRequestedAt = now;
        request.autoCompleteAt = new Date(now.getTime() + timeoutMinutes * 60000);

        await request.save();

        emitOrderStatusUpdate(request._id.toString(), {
            orderId: request._id.toString(),
            status: request.status
        });

        console.log("Marked as waiting for confirmation", request);
        return res.status(200).json(
            ApiResponse.success("Marked as waiting for confirmation", request)
        );

    } catch (err) {
        console.error(err);
        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});

// // ================= Update Shop FCM Token =================
// router.put("/updateShopFcmToken", async (req, res) => {

//     console.log("-----API Update Shop FCM Token-----");

//     try {

//         const { shopId, fcmToken } = req.body;

//         // ✅ Validation
//         if (!shopId || !fcmToken) {
//             console.log("Invalid body:", req.body);
//             return res.status(400).json(
//                 ApiResponse.error("shopId and fcmToken are required", 400)
//             );
//         }

//         // ✅ Update mechanic
//         const shop = await Shop.findByIdAndUpdate(
//             shopId,
//             { fcmToken: fcmToken },
//             { returnDocument: "after" }
//         );

//         if (!shop) {
//             console.log("Shop not found");
//             return res.status(404).json(
//                 ApiResponse.error("Shop not found", 404)
//             );
//         }

//         console.log("Shop FCM token updated successfully");

//         return res.status(200).json(
//             ApiResponse.success(
//                 "Shop FCM token updated successfully",
//                 {
//                     shopId: shop._id,
//                     fcmToken: shop.fcmToken
//                 }
//             )
//         );

//     } catch (error) {

//         console.error("Error updating Shop FCM token:", error);

//         return res.status(500).json(
//             ApiResponse.error("Failed to update Shop FCM token", 500)
//         );
//     }
// });


// ================= Update Mechanic FCM Token =================
router.put("/updateMechanicFcmToken", async (req, res) => {

    console.log("-----API Update Mechanic FCM Token-----");

    try {

        const { mechanicId, fcmToken } = req.body;

        // Validation
        if (!mechanicId || !fcmToken) {
            console.log("Invalid body:", req.body);
            return res.status(400).json(
                ApiResponse.error("mechanicId and fcmToken are required", 400)
            );
        }

        // Update mechanic
        const mechanic = await Mechanic.findByIdAndUpdate(
            mechanicId,
            { fcmToken: fcmToken },
            { returnDocument: "after" }
        );

        if (!mechanic) {
            console.log("Mechanic not found");
            return res.status(404).json(
                ApiResponse.error("Mechanic not found", 404)
            );
        }

        console.log("Mechanic FCM token updated successfully");

        return res.status(200).json(
            ApiResponse.success(
                "FCM token updated successfully",
                {
                    mechanicId: mechanic._id,
                    fcmToken: mechanic.fcmToken
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


// ================= Update Mechanic Location =================
router.post("/updateLocation", async (req, res) => {
    console.log("-----API Update Mechanic Location-----");

    try {
        const { mechanicId, latitude, longitude, address } = req.body;

        // Validate input
        if (!mechanicId || !latitude || !longitude) {
            return res.status(400).json(
                ApiResponse.error("mechanicId, latitude and longitude are required", 400)
            );
        }

        const mechanic = await Mechanic.findByIdAndUpdate(
            mechanicId,
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

        if (!mechanic) {
            return res.status(404).json(
                ApiResponse.error("Mechanic not found", 404)
            );
        }

        return res.status(200).json(
            ApiResponse.success("Location updated successfully", mechanic)
        );

    } catch (error) {
        console.error(error);

        return res.status(500).json(
            ApiResponse.error(error.message, 500)
        );
    }
});


// WORKERS API

// ==================== Worker Join Shop ==========================
router.post("/workerShopRegister", async (req, res) => {
    console.log("-----API Worker Join Shop-----");

    try {
        const { mechanicId, shopId } = req.body;

        if (!mechanicId || !shopId) {
            console.log("mechanicId and shopId are required");
            return res.status(400).json(
                ApiResponse.error("mechanicId and shopId are required", 400)
            );
        }

        const mongoose = require("mongoose");

        if (!mongoose.Types.ObjectId.isValid(shopId)) {

            console.log("Invalid ShopId");
            return res.status(400).json(
                ApiResponse.error("Shop ID is invalid!", 400)
            );
        }

        const shop = await Shop.findById(shopId);
        if (!shop) {
            console.log("Shop not found");
            return res.status(404).json(
                ApiResponse.error("Shop not found", 404)
            );
        }

        const worker = await Mechanic.findById(mechanicId);
        if (!worker) {
            console.log("Worker not found");
            return res.status(404).json(
                ApiResponse.error("Worker not found", 404)
            );
        }

        if (shop.workers.includes(mechanicId)) {
            console.log("Worker already added to this shop");
            return res.status(400).json(
                ApiResponse.error("Worker already added to this shop", 400)
            );
        }

        await Shop.findByIdAndUpdate(
            shopId,
            { $addToSet: { workers: mechanicId } },
            { new: true }
        );

        const updatedWorker = await Mechanic.findByIdAndUpdate(
            mechanicId,
            { shopId: shopId },
            { new: true }
        );

        console.log("Worker added to shop successfully");
        return res.status(200).json(
            ApiResponse.success("Worker added to shop successfully", {
                shop,
                mechanic: {
                    _id: updatedWorker._id,
                    shopId: updatedWorker.shopId,
                    name: updatedWorker.name,
                    phoneNumber: updatedWorker.phoneNumber,
                    role: updatedWorker.role,
                    address: updatedWorker.address,
                    status: updatedWorker.status
                }
            })
        );

    } catch (err) {
        console.error(err);
        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});


// ================= Get All Workers By ShopId =================
router.post("/getShopWorkers", async (req, res) => {
    console.log("-----API Get Shop Workers-----");

    try {

        const { id } = req.body;
        const shopId = id;

        // Validation
        if (!shopId) {
            console.log("Shop ID is required");
            return res.status(400).json(
                ApiResponse.error("Shop ID is required", 400)
            );
        }

        // Fetch workers (exclude owner)
        const workers = await Mechanic.find({
            shopId: shopId,
            role: "worker"
        }).sort({ createdAt: -1 });

        if (!workers || workers.length === 0) {
            console.log("No workers found for this shop");
            return res.status(200).json(
                ApiResponse.success("No workers found", [])
            );
        }

        // Response formatting
        const response = workers.map(worker => ({
            _id: worker._id,
            shopId: worker.shopId,
            name: worker.name,
            phoneNumber: worker.phoneNumber,
            role: worker.role,
            address: worker.address,
            status: worker.status,

            location: worker.location?.coordinates
                ? {
                    latitude: worker.location.coordinates[1],
                    longitude: worker.location.coordinates[0]
                }
                : null,

            createdAt: worker.createdAt
        }));

        console.log("Workers fetched successfully:", response);

        return res.status(200).json(
            ApiResponse.success("Workers fetched successfully", response)
        );

    } catch (err) {
        console.error(err);
        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});

// ================= Get Customer Details =================
router.post("/getCustomerDetails", async (req, res) => {
    console.log("-----API Get Customer Details-----");

    try {
        const { id } = req.body;
        const customerId = id;

        if (!customerId) {
            return res.status(400).json(
                ApiResponse.error("customerId is required", 400)
            );
        }

        const customer = await Customer.findById(customerId)
            .select("name phoneNumber");

        if (!customer) {
            return res.status(404).json(
                ApiResponse.error("Customer not found", 404)
            );
        }

        return res.status(200).json(
            ApiResponse.success("Customer fetched successfully", customer)
        );

    } catch (err) {
        console.error(err);
        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});

// ================= Get Service Details =================
router.post("/getServiceDetails", async (req, res) => {
    console.log("-----API Get Service Details-----");

    try {
        const { id } = req.body;
        const serviceId = id;

        if (!serviceId) {
            return res.status(400).json(
                ApiResponse.error("serviceId is required", 400)
            );
        }

        const service = await Services.findById(serviceId)
            .select("service description");

        if (!service) {
            return res.status(404).json(
                ApiResponse.error("Service not found", 404)
            );
        }

        return res.status(200).json(
            ApiResponse.success("Service fetched successfully", {
                serviceName: service.service,
                description: service.description
            })
        );

    } catch (err) {
        console.error(err);
        return res.status(500).json(
            ApiResponse.error("Server error", 500)
        );
    }
});

module.exports = router;


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
            .select("shopName phoneNumber rating address status openingTime closingTime supportedVehicles");

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


// ================= GET COMPLETE MECHANIC DATA =================

router.post(
    "/getCompleteMechanicData",

    async (req, res) => {

        console.log(
            "-----API Get Complete Mechanic Data-----"
        );

        try {

            /*
             * GET BODY
             */
            const {
                id
            } = req.body;

            const mechanicId = id;

            console.log("Request Data", req.body);
            /*
             * VALIDATION
             */
            if (!mechanicId) {
                console.log(
                    "mechanicId is required", req.body
                );

                return res.status(400).json(

                    ApiResponse.error(
                        "mechanicId is required",
                        400
                    )
                );
            }

            /*
             * GET MECHANIC
             */
            const mechanic =
                await Mechanic.findById(
                    mechanicId
                );

            if (!mechanic) {

                console.log(
                    "mechanic not found", req.body
                );

                return res.status(404).json(
                    ApiResponse.error(
                        "Mechanic not found",
                        404
                    )
                );
            }

            /*
             * GET SHOP
             */
            let shop = null;

            if (mechanic.shopId) {

                shop =
                    await Shop.findById(
                        mechanic.shopId
                    );
            }

            /*
             * GET SERVICES
             */
            let services = [];

            if (mechanic.shopId) {

                services =
                    await Services.find({

                        shopId:
                            mechanic.shopId
                    });
            }

            /*
             * FORMAT MECHANIC
             */
            const mechanicResponse = {

                _id:
                    mechanic._id,

                shopId:
                    mechanic.shopId,

                profileImage:
                    mechanic.profileImage,

                name:
                    mechanic.name,

                phoneNumber:
                    mechanic.phoneNumber,

                role:
                    mechanic.role,

                address:
                    mechanic.address,

                location:
                    mechanic.location?.coordinates
                        ? {

                            latitude:
                                mechanic.location.coordinates[1],

                            longitude:
                                mechanic.location.coordinates[0]
                        }
                        : null,

                status:
                    mechanic.status,

                fcmToken:
                    mechanic.fcmToken,

                createdAt:
                    mechanic.createdAt,

                updatedAt:
                    mechanic.updatedAt
            };

            /*
             * FORMAT SHOP
             */
            let shopResponse = null;

            if (shop) {

                shopResponse = {

                    _id:
                        shop._id,

                    ownerId:
                        shop.ownerId,

                    shopImage:
                        shop.shopImage,


                    rating: shop.rating,
                    ratingCount: shop.ratingCount,
                    ratingSum: shop.ratingSum,

                    shopName:
                        shop.shopName,

                    phoneNumber:
                        shop.phoneNumber,

                    address:
                        shop.address,

                    location:
                        shop.location?.coordinates
                            ? {

                                latitude:
                                    shop.location.coordinates[1],

                                longitude:
                                    shop.location.coordinates[0]
                            }
                            : null,

                    status:
                        shop.status,

                    rating:
                        shop.rating,

                    openingTime:
                        shop.openingTime,

                    closingTime:
                        shop.closingTime,

                    supportedVehicles:
                        shop.supportedVehicles,

                    workers:
                        shop.workers,

                    fcmToken:
                        shop.fcmToken,

                    createdAt:
                        shop.createdAt,

                    updatedAt:
                        shop.updatedAt
                };
            }

            /*
             * FORMAT SERVICES
             */
            const servicesResponse =
                services.map(service => ({

                    _id:
                        service._id,

                    shopId:
                        service.shopId,

                    service:
                        service.service,

                    description:
                        service.description,

                    price:
                        service.price
                }));

            /*
             * FINAL RESPONSE
             */

            console.log("Complete mechanic data fetched successfully", {

                mechanic:
                    mechanicResponse,

                shop:
                    shopResponse,

                services:
                    servicesResponse
            });
            return res.status(200).json(

                ApiResponse.success(

                    "Complete mechanic data fetched successfully",

                    {

                        mechanic:
                            mechanicResponse,

                        shop:
                            shopResponse,

                        services:
                            servicesResponse
                    }
                )
            );

        } catch (err) {

            console.error(
                "GET COMPLETE MECHANIC DATA ERROR"
            );

            console.error(err);

            return res.status(500).json(

                ApiResponse.error(
                    "Server error",
                    500
                )
            );
        }
    }
);