import fs from "fs";
import mongoose from "mongoose";
import Service from "../models/Service.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const isValidId = (id) => mongoose.isValidObjectId(id);

const removeTempFile = (filePath) => {
  if (!filePath) return;
  fs.unlink(filePath, () => {});
};

const parseJsonArrayField = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (typeof field === "string") {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) return parsed;
      return typeof parsed === "string" ? [parsed] : [];
    } catch {
      return field
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
};

function normalizeSlotsToMap(slotStrings = []) {
  const map = {};

  slotStrings.forEach((raw) => {
    const str = String(raw);
    const m = str.match(
      /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s*•\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
    );
    const monthIdx = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;

    if (!m || monthIdx < 0) {
      map["unspecified"] = map["unspecified"] || [];
      map["unspecified"].push(str);
      return;
    }

    const [, day, , year, hour, minute, ampm] = m;
    const mm = String(monthIdx + 1).padStart(2, "0");
    const dd = String(Number(day)).padStart(2, "0");
    const dateKey = `${year}-${mm}-${dd}`;
    const timeStr = `${String(Number(hour)).padStart(
      2,
      "0"
    )}:${minute} ${ampm.toUpperCase()}`;

    map[dateKey] = map[dateKey] || [];
    map[dateKey].push(timeStr);
  });

  Object.keys(map).forEach((k) => {
    map[k] = Array.from(new Set(map[k]));
  });

  return map;
}

const sanitizePrice = (v) =>
  Math.max(0, Number(String(v ?? "0").replace(/[^\d.-]/g, "")) || 0);

const parseAvailability = (v) => {
  const s = String(v ?? "available").toLowerCase();
  return s === "available" || s === "true";
};

// TO CREATE A SERVICE
export const createService = async (req, res) => {
  try {
    const b = req.body || {};

    if (!b.name || !String(b.name).trim()) {
      removeTempFile(req.file?.path);
      return res.status(400).json({
        success: false,
        message: "Service name is required",
      });
    }

    const instructions = parseJsonArrayField(b.instructions);
    const slots = normalizeSlotsToMap(parseJsonArrayField(b.slots));
    const numericPrice = sanitizePrice(b.price);
    const available = parseAvailability(b.availability);

    let imageUrl = null;
    let imagePublicId = null;

    if (req.file?.path) {
      try {
        const up = await uploadToCloudinary(req.file.path, "services");
        imageUrl = up?.secure_url || null;
        imagePublicId = up?.public_id || null;
      } catch (err) {
        console.error("Cloudinary upload error:", err);
      } finally {
        removeTempFile(req.file.path);
      }
    }

    const service = new Service({
      name: String(b.name).trim(),
      about: b.about || "",
      shortDescription: b.shortDescription || "",
      price: numericPrice,
      available,
      instructions,
      slots,
      imageUrl,
      imagePublicId,
    });

    const saved = await service.save();

    return res.status(201).json({
      success: true,
      message: "Service Created",
      data: saved,
    });
  } catch (error) {
    console.error("CreateService Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// TO GET SERVICE
export const getService = async (req, res) => {
  try {
    const list = await Service.find().sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      message: "Fetched all services successfully",
      data: list,
    });
  } catch (error) {
    console.error("GetService Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// TO GET SERVICE BY ID
export const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service id",
      });
    }

    const service = await Service.findById(id).lean();

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    console.error("GetServiceById Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// TO UPDATE A SERVICE
export const updateService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      removeTempFile(req.file?.path);
      return res.status(400).json({
        success: false,
        message: "Invalid service id",
      });
    }

    const existing = await Service.findById(id);

    if (!existing) {
      removeTempFile(req.file?.path);
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const b = req.body || {};
    const updateData = {};

    if (b.name !== undefined) updateData.name = String(b.name).trim();
    if (b.about !== undefined) updateData.about = b.about;
    if (b.shortDescription !== undefined) {
      updateData.shortDescription = b.shortDescription;
    }
    if (b.price !== undefined) updateData.price = sanitizePrice(b.price);
    if (b.availability !== undefined) {
      updateData.available = parseAvailability(b.availability);
    }
    if (b.instructions !== undefined) {
      updateData.instructions = parseJsonArrayField(b.instructions);
    }
    if (b.slots !== undefined) {
      updateData.slots = normalizeSlotsToMap(parseJsonArrayField(b.slots));
    }

    if (req.file?.path) {
      try {
        const up = await uploadToCloudinary(req.file.path, "services");

        if (up?.secure_url) {
          updateData.imageUrl = up.secure_url;
          updateData.imagePublicId = up.public_id || null;

          if (existing.imagePublicId) {
            try {
              await deleteFromCloudinary(existing.imagePublicId);
            } catch (err) {
              console.warn("Cloudinary delete failed:", err?.message || err);
            }
          }
        }
      } catch (err) {
        console.error("Cloudinary upload error:", err);
      } finally {
        removeTempFile(req.file.path);
      }
    }

    const updated = await Service.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      data: updated,
      message: "Service Updated",
    });
  } catch (error) {
    console.error("UpdateService Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// TO DELETE A SERVICE
export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service id",
      });
    }

    const existing = await Service.findById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    if (existing.imagePublicId) {
      try {
        await deleteFromCloudinary(existing.imagePublicId);
      } catch (error) {
        console.warn(
          "Failed to delete image from Cloudinary:",
          error?.message || error
        );
      }
    }

    await existing.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Service Deleted",
    });
  } catch (error) {
    console.error("DeleteService Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
