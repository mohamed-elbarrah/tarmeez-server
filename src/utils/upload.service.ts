import { Injectable, BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

@Injectable()
export class UploadService {
  private static readonly UPLOAD_DIR = 'uploads/stores';

  constructor() {
    this.ensureDirExists();
  }

  private ensureDirExists() {
    if (!fs.existsSync(UploadService.UPLOAD_DIR)) {
      fs.mkdirSync(UploadService.UPLOAD_DIR, { recursive: true });
    }
  }

  static getMulterOptions() {
    return {
      storage: diskStorage({
        destination: (req, file, cb) => {
          if (!fs.existsSync(this.UPLOAD_DIR)) {
            fs.mkdirSync(this.UPLOAD_DIR, { recursive: true });
          }
          cb(null, this.UPLOAD_DIR);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `store-asset-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.svg', '.ico', '.webp'];
        const ext = extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
          return cb(new BadRequestException('Invalid file type. Allowed: ' + allowed.join(', ')), false as any);
        }
        cb(null, true as any);
      },
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    };
  }

  static getRelativePath(filename: string): string {
    return `/uploads/stores/${filename}`;
  }
}
