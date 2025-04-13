import { Router } from 'express'
import { pingController } from '../controllers/ping'
import multer from 'multer';
import { loginUser, loginAdmin, updatePassword } from '../controllers/authController';
import { createAdminController, deleteAdminController, listAdminsController } from '../controllers/masterAdminController';
import { uploadPayroll, checkJobStatus } from '../controllers/payrollController';
import { getPresignedUrl, processS3Upload } from '../controllers/s3Controller';
import { authenticateAdmin } from '../middlewares/authMiddleware';
import { contra_chequeController } from '../controllers/contra_chequeController';
import { verifyToken } from '../utils/jwt';
import { getAvailablePeriods } from '../controllers/getPeriods';


export const mainRouter = Router()

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // Limite de 50MB
});

mainRouter.get('/ping', pingController)

//Login do usuário
mainRouter.post('/login/user', loginUser);
mainRouter.get('/contra-cheques', verifyToken, contra_chequeController)
mainRouter.get('/yearMonth', verifyToken, getAvailablePeriods);
mainRouter.put('/user', verifyToken, updatePassword);

//Login do administrador/contador
mainRouter.post('/login/admin', loginAdmin);

//Upload de PDF/contra-cheques (requer autenticação de admin)
mainRouter.post('/upload/payroll', authenticateAdmin, upload.single('file'), uploadPayroll);
mainRouter.get('/upload/payroll/status/:jobId', authenticateAdmin, checkJobStatus);

// Novas rotas para upload direto no S3 (para arquivos grandes)
mainRouter.post('/presigned-url', authenticateAdmin, getPresignedUrl);
mainRouter.post('/process-s3-upload', authenticateAdmin, processS3Upload);

//admin master
mainRouter.get('/master', authenticateAdmin, listAdminsController);
mainRouter.post('/master', authenticateAdmin, createAdminController);
mainRouter.delete('/master/:id', authenticateAdmin, deleteAdminController);