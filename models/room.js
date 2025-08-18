const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true, // Aynı oda ID tekrar olmasın
  },
  password: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Room", RoomSchema);
