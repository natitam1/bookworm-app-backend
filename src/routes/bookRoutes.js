import express from "express";
import cloudinary from "../lib/cloudinary.js";
import protectRoute from "../middleware/auth.middleware.js";
import Book from "../models/Book.js";

const router = express.Router();

// CREATE a new book
router.post("/", protectRoute, async (req, res) => {
  try {
    const { title, caption, rating, image } = req.body;

    if (!title || !caption || !rating || !image) {
      return res.status(400).json({ message: "Please provide all fields" });
    }

    // Upload the image to Cloudinary
    const uploadResponse = await cloudinary.uploader.upload(image, {
      folder: "books",
    });
    const imageUrl = uploadResponse.secure_url;
    const publicId = uploadResponse.public_id;

    // Save book to database
    const newBook = new Book({
      title,
      caption,
      rating,
      image: imageUrl,
      cloudinaryId: publicId, // store public_id for safer deletion
      user: req.user._id,
    });

    await newBook.save();
    res.status(201).json({ newBook });
  } catch (error) {
    console.log("Error creating book:", error);
    res.status(500).json({ message: error.message });
  }
});

// GET all books (paginated)
router.get("/", protectRoute, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const books = await Book.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "username profileImage");

    const totalBooks = await Book.countDocuments();

    res.status(200).json({
      books,
      currentPage: page,
      totalBooks,
      totalPages: Math.ceil(totalBooks / limit),
    });
  } catch (error) {
    console.log("Error in get all books route:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE a book
router.delete("/:id", protectRoute, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found" });

    if (book.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Delete from Cloudinary
    if (book.cloudinaryId) {
      try {
        await cloudinary.uploader.destroy(book.cloudinaryId);
      } catch (deleteError) {
        console.log("Error deleting image from Cloudinary:", deleteError);
      }
    }

    await book.deleteOne();
    res.json({ message: "Book deleted successfully" });
  } catch (error) {
    console.log("Error deleting book:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET books of logged-in user
router.get("/users", protectRoute, async (req, res) => {
  try {
    const books = await Book.find({ user: req.user._id }).sort({
      createdAt: -1,
    });
    res.status(200).json(books);
  } catch (error) {
    console.log("Get user books error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
