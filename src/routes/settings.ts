import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { upload } from "../middleware/upload";
import {
  getUserSettings,
  updateUserSettings,
  uploadDisplayPicture,
  uploadBanner,
  removeDisplayPicture,
  removeBanner,
} from "../controllers/settingsController";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get("/", getUserSettings);
router.put("/", updateUserSettings);
router.post("/upload/display-picture", upload.single("file"), uploadDisplayPicture);
router.post("/upload/banner", upload.single("file"), uploadBanner);
router.delete("/display-picture", removeDisplayPicture);
router.delete("/banner", removeBanner);

export default router;
