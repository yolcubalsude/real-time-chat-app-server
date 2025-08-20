

const express = require("express");
const User = require("../models/User");
const router = express.Router();

// Kayıt (Register)
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const userExists = await User.findOne({ username });
    if (userExists) return res.status(400).json({ message: "Kullanıcı zaten var" });

    const user = await User.create({ username, password });
    res.json({ message: "Kayıt başarılı", user });
  } catch (err) {
    res.status(500).json({ message: "Sunucu hatası", error: err.message });
  }
});

// Giriş (Login)
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) return res.status(400).json({ message: "Kullanıcı bulunamadı" });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ message: "Hatalı şifre" });

    res.json({ message: "Giriş başarılı!" });
  } catch (err) {
    res.status(500).json({ message: "Sunucu hatası", error: err.message });
  }
});

module.exports = router;


