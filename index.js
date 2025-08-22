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

console.log(process.env.MONGO_URI);

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error(err));

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

const Message = require("./models/Message");

io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);
    socket.on("create_room", async ({ roomId, password, username }) => {
        try {
            const existingRoom = await Room.findOne({ roomId });
            if (existingRoom) {
                console.log("ROOM EXISTS");
                socket.emit("room_exists", { message: "Bu oda zaten mevcut!" });
                return;
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newRoom = new Room({ roomId, password: hashedPassword });
            console.log("newRoom, ", newRoom);
            await newRoom.save();

            socket.join(roomId);
            socket.emit("room_created", { roomId });
            console.log(`${username} yeni bir oda oluşturdu: ${roomId}`);
        } catch (err) {
            console.error(err);
            socket.emit("error", { message: "Oda oluşturulamadı." });
        }
    });

    // Kullanıcı yazıyor
    socket.on("typing", ({ room, username }) => {
        if (!room) return;
        socket.to(room).emit("typing", { username });
    });

    // Kullanıcı yazmayı bıraktı
    socket.on("stop_typing", ({ room, username }) => {
        if (!room) return;
        socket.to(room).emit("stop_typing", { username });
    });

    socket.on(
        "join_room",
        async ({ username, userPassword, roomId, roomPassword }) => {
            try {
                const room = await Room.findOne({ roomId });
                if (!room) {
                    socket.emit("join_error", { error: "Oda bulunamadı" });
                    return;
                }
                const isMatch = await bcrypt.compare(
                    roomPassword,
                    room.password
                );
                if (!isMatch) {
                    socket.emit("join_error", { error: "Şifre yanlış" });
                    return;
                }

                socket.join(roomId);
                socket.emit("join_success", { roomId });
            } catch (err) {
                console.error(err);
                socket.emit("join_error", { error: "Sunucu hatası" });
            }
            socket.join(roomId);

            const room = await Room.findOne({ roomId: roomId });

            if (room) {
                const alreadyExists = room.users.some(
                    (u) => u.username === username
                );

                if (!alreadyExists) {
                    room.users.push({ username });
                    await room.save();
                }

                io.to(roomId).emit("room_users", room.users);
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
        console.log(`User Disconnected: ${socket.id}`);
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

                console.log(
                    `${socket.username} odadan çıktı (leftAt kaydedildi).`
                );
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

app.get("/messages/:room", async (req, res) => {
    try {
        const room = req.params.room;
        const messages = await require("./models/Message").find({ room });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

server.listen(3001, () => {
    console.log("SERVER RUNNING");
});
