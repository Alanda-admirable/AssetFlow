import { getDb } from "../../../db";
import { initDatabase } from "../../../db/init";
import { documents } from "../../../db/schema";
import { getActor } from "../../lib/actor";
import { isCloudinaryConfigured, uploadImageToCloudinary } from "../../lib/cloudinary";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await initDatabase();
    const actor = await getActor(request);
    if (!actor) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    
    const form = await request.formData();
    const relatedType = String(form.get("relatedType") || "general");
    if (actor.roleCode === "staff" && !["request", "maintenance"].includes(relatedType)) {
      return Response.json({ error: "ผู้ใช้ทั่วไปแนบไฟล์ได้เฉพาะคำขอและรายการแจ้งซ่อม" }, { status: 403 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "ไม่พบไฟล์" }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return Response.json({ error: "ไฟล์ต้องไม่เกิน 15 MB" }, { status: 400 });

    const safeName = file.name.replace(/[^a-zA-Z0-9ก-๙._-]/g, "-");
    const buffer = Buffer.from(await file.arrayBuffer());
    let objectKey = "";

    // If Cloudinary is configured and file is an image, upload directly to Cloudinary
    if (isCloudinaryConfigured() && (file.type.startsWith("image/") || file.name.match(/\.(jpg|jpeg|png|webp|gif)$/i))) {
      try {
        const cloudinaryResult = await uploadImageToCloudinary(buffer, safeName, "assetflow/uploads");
        objectKey = cloudinaryResult.url;
      } catch (cloudErr) {
        console.error("Cloudinary upload failed, falling back to local:", cloudErr);
      }
    }

    // Fallback to local storage if not uploaded to Cloudinary
    if (!objectKey) {
      const uploadSubdir = path.join(process.cwd(), "public", "uploads", "documents");
      await fs.mkdir(uploadSubdir, { recursive: true });
      const filename = `${Date.now()}-${safeName}`;
      const filePath = path.join(uploadSubdir, filename);
      await fs.writeFile(filePath, buffer);
      objectKey = `/uploads/documents/${filename}`;
    }

    const db = getDb();
    const [document] = await db.insert(documents).values({
      documentType: String(form.get("documentType") || "other"),
      relatedType,
      relatedId: Number(form.get("relatedId")) || 0,
      title: String(form.get("title") || file.name),
      objectKey,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      uploadedBy: actor.id,
    }).returning();

    return Response.json({ document }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ" }, { status: 500 });
  }
}
