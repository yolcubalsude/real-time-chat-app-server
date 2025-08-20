const express = require("express");
const app = express();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const Room = require("./models/room");
//const authRoutes = require("./routes/auth");
//app.use("/auth", authRoutes);

console.log(process.env.MONGO_URI)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error(err));


const server = http.createServer(app);

const io = new Server(server, {   
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
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
      const newRoom = new Room({ roomId, password });
      console.log("newRoom, ", newRoom)
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

  socket.on("join_room", async ({ username, password, roomId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) {
        socket.emit("join_error", { error: "Oda bulunamadı" });
        return;
      }
      if (room.password !== password) {
        socket.emit("join_error", { error: "Şifre yanlış" });
        return;
      }
  
      socket.join(roomId);
      socket.emit("join_success", { roomId });
    } catch (err) {
      console.error(err);
      socket.emit("join_error", { error: "Sunucu hatası" });
    }
  });
  
  socket.on("send_message", async (data) => {
    try {
      const newMessage = new Message(data);
      await newMessage.save();
      socket.to(data.room).emit("receive_message", data);
    } catch (err) {
      console.error("Message save error:", err);
    }
  });
  


  socket.on("disconnect", () => {
    console.log(`User Disconnected: ${socket.id}`);
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

