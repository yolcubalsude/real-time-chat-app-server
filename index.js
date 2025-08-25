const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const Room = require("./models/room");
const User = require("./models/User");

const app = express();
app.use(cors());
app.use(express.json());

require("dotenv").config();

const authRoutes = require("./routes/auth");
app.use("/auth", authRoutes);

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error(err));

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "https://real-time-chat-app-client-two.vercel.app",
        ],
        methods: ["GET", "POST"],
        credentials: true,
    },
});

const Message = require("./models/Message");

io.on("connection", (socket) => {
    socket.on("create_room", async ({ roomId, password }) => {
        try {
            const existingRoom = await Room.findOne({ roomId });
            if (existingRoom) {
                socket.emit("room_exists", {
                    message: "This room already exists.",
                });
                return;
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newRoom = new Room({ roomId, password: hashedPassword });
            await newRoom.save();

            socket.emit("room_created", { roomId, message: "Room created." });
        } catch (err) {
            console.error(err);
            socket.emit("error", { message: "Failed to create room." });
        }
    });

    socket.on("typing", ({ room, username }) => {
        if (!room) return;
        socket.to(room).emit("typing", { username });
    });

    socket.on("stop_typing", ({ room, username }) => {
        if (!room) return;
        socket.to(room).emit("stop_typing", { username });
    });

    socket.on(
        "join_room",
        async ({ username, roomId, roomPassword, bypassPassword }) => {
            try {
                const room = await Room.findOne({ roomId });
                if (!room) {
                    socket.emit("join_error", { error: "Room not found" });
                    return;
                }

                if (!bypassPassword) {
                    const isMatch = await bcrypt.compare(
                        roomPassword,
                        room.password
                    );
                    if (!isMatch) {
                        socket.emit("join_error", {
                            error: "Incorrect password",
                        });
                        return;
                    }
                }

                socket.join(roomId);
                socket.emit("join_success", { roomId });
                socket.username = username;
                socket.roomId = roomId;

                await User.updateOne(
                    { username },
                    { $pull: { joinedRooms: { roomId: room.roomId } } }
                );
                await User.updateOne(
                    { username },
                    {
                        $push: {
                            joinedRooms: {
                                roomId: room.roomId,
                                lastJoinedAt: new Date(),
                            },
                        },
                    }
                );

                const alreadyExists = room.users.some(
                    (u) => u.username === username
                );
                if (!alreadyExists) {
                    room.users.push({ username });
                    await room.save();
                }

                io.to(roomId).emit("room_users", room.users);
            } catch (err) {
                console.error(err);
                socket.emit("join_error", { error: "Server error" });
            }
        }
    );

    socket.on("send_message", async (data) => {
        try {
            const newMessage = new Message(data);
            await newMessage.save();
            socket.to(data.room).emit("receive_message", data);
        } catch (err) {
            console.error("Message save error:", err);
        }
    });

    socket.on("disconnect", async () => {
        if (socket.username && socket.roomId) {
            try {
                await Room.updateOne(
                    {
                        roomId: socket.roomId,
                        "users.username": socket.username,
                    },
                    { $set: { "users.$.leftAt": new Date() } }
                );

                const updatedRoom = await Room.findOne({
                    roomId: socket.roomId,
                });
                io.to(socket.roomId).emit("room_users", updatedRoom.users);
            } catch (err) {
                console.error(
                    "Disconnect sırasında leftAt güncellenemedi:",
                    err
                );
            }
        }
    });
});

app.get("/", (req, res) => {
    res.send("ok");
});
app.get("/user/:username/rooms", async (req, res) => {
    try {
        const { username } = req.params;
        const user = await User.findOne({ username });
        if (!user)
            return res.status(404).json({ error: "Kullanıcı bulunamadı" });

        res.json(user.joinedRooms);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Sunucu hatası" });
    }
});

app.get("/messages/:room", async (req, res) => {
    try {
        const room = req.params.room;
        const messages = await Message.find({ room });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`SERVER RUNNING on port ${PORT}`);
});
