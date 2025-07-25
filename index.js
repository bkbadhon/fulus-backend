const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const Port = 5000;

// CORS Configuration
const corsOptions = {
  origin: ["http://localhost:5173", "https://fulus-topaz.vercel.app"],
  credentials: true,
};

app.use(express.json());
app.use(cors(corsOptions));

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.t87ip2a.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// MongoDB Client Setup
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Global Collection Reference
let usersCollection;

// Connect to MongoDB Once
async function connectToMongoDB() {
  try {
    await client.connect();
    const db = client.db("fulus");
    usersCollection = db.collection("users");
    console.log("✅ MongoDB connected & collection ready.");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }
}
connectToMongoDB();


// API Routes

// POST /api/users - Create a new user
app.post("/api/users", async (req, res) => {
  try {
    if (!usersCollection) {
      return res.status(503).json({ success: false, message: "DB not connected" });
    }

    const userData = req.body;
    const { name, phone, password, avatarUrl } = userData;

    if (!name || !phone || !password || !avatarUrl) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const result = await usersCollection.insertOne(userData);
    res.status(201).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/users - Get all users (excluding password)
app.get("/api/users", async (req, res) => {
  try {
    if (!usersCollection) {
      return res.status(503).json({ success: false, message: "DB not connected" });
    }

    const users = await usersCollection.find().toArray();
    const safeUsers = users.map(({ password, ...user }) => user); // Remove password

    res.status(200).json(safeUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/login - User login
app.post("/api/login", async (req, res) => {
  try {
    if (!usersCollection) {
      return res.status(503).json({ success: false, message: "DB not connected" });
    }

    let { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ success: false, message: "User ID and password are required" });
    }

    userId = Number(userId);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: "User ID must be a number" });
    }

    const user = await usersCollection.findOne({ userId, password });

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        userId: user.userId,
        role: user.role || "user",
        avatarUrl: user.avatarUrl,
        balance: user.balance || 0,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Base Route
app.get("/", (req, res) => {
  res.send({ message: "Welcome to our server!" });
});

// Start Server
app.listen(Port, () => {
  console.log(`🚀 Server is running at http://localhost:${Port}`);
});
