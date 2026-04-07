import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class UploadService {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor(private configService: ConfigService) {
    const accountId = this.configService.get('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get('R2_SECRET_ACCESS_KEY');
    
    this.bucketName = this.configService.get('R2_BUCKET_NAME') || '';
    this.publicUrl = this.configService.get('R2_PUBLIC_URL') || '';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      console.warn('R2 credentials not fully configured. Uploads may fail.');
    }

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
    });
  }

  static getMulterOptions() {
    return {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.svg', '.ico', '.webp'];
        const ext = extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
          return cb(new BadRequestException('Invalid file type. Allowed: ' + allowed.join(', ')), false as any);
        }
        cb(null, true as any);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    };
  }

  async uploadFile(file: Express.Multer.File, keyPath: string): Promise<string> {
    try {
      const ext = extname(file.originalname).toLowerCase();
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const filename = `${uniqueSuffix}${ext}`;
      
      const fullPath = `${keyPath}/${filename}`.replace(/^\/+/, ''); // Remove leading slash if any

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fullPath,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      // Return the public URL
      const normalizedPublicUrl = this.publicUrl.endsWith('/') ? this.publicUrl.slice(0, -1) : this.publicUrl;
      return `${normalizedPublicUrl}/${fullPath}`;
    } catch (error) {
      console.error('Error uploading file to R2:', error);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }
}
