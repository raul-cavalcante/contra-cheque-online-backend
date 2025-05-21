import { Router } from 'express'
import { pingController } from '../controllers/ping'
import multer from 'multer';
import { loginUser, loginAdmin, updatePassword } from '../controllers/authController';
import { createAdminController, deleteAdminController, listAdminsController } from '../controllers/masterAdminController';
import { uploadPayroll, checkJobStatus } from '../controllers/payrollController';
import { getPresignedUrl, processS3Upload, checkProcessingStatus } from '../controllers/s3Controller';
import { authenticateAdmin } from '../middlewares/authMiddleware';
import { contra_chequeController } from '../controllers/contra_chequeController';
import { verifyToken } from '../utils/jwt';
import { getAvailablePeriods } from '../controllers/getPeriods';

const mainRouter = Router()

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

// Rotas de upload e processamento de contra-cheques
// 1. Upload direto para S3 (recomendado para arquivos grandes)
mainRouter.post('/presigned-url', authenticateAdmin, getPresignedUrl);
mainRouter.post('/process-s3-upload', authenticateAdmin, processS3Upload);
mainRouter.get('/process-s3-upload/status/:jobId', authenticateAdmin, checkProcessingStatus);

// 2. Upload tradicional (deprecated, usar upload S3 para melhor performance)
mainRouter.post('/upload/payroll', authenticateAdmin, upload.single('file'), uploadPayroll);
mainRouter.get('/upload/payroll/status/:jobId', authenticateAdmin, checkJobStatus);

// Para manter compatibilidade com clientes antigos
mainRouter.get('/status/:jobId', authenticateAdmin, (req, res) => {
  // Redireciona para a nova rota
  const newUrl = `/process-s3-upload/status/${req.params.jobId}`;
  console.log(`Redirecionando requisição antiga de /status para ${newUrl}`);
  res.redirect(307, newUrl);
});

//admin master
mainRouter.get('/master', authenticateAdmin, listAdminsController);
mainRouter.post('/master', authenticateAdmin, createAdminController);
mainRouter.delete('/master/:id', authenticateAdmin, deleteAdminController);

export { mainRouter };


