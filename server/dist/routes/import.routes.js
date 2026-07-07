"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const import_controller_1 = require("../controllers/import.controller");
const upload_1 = require("../middleware/upload");
const router = (0, express_1.Router)();
router.post('/', upload_1.uploadMiddleware.single('file'), import_controller_1.handleImport);
exports.default = router;
