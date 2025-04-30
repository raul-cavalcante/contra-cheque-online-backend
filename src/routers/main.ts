import { Router } from 'express';
import { login, updatePassword } from '../controllers/authController';
import { getContraCheque } from '../controllers/contra_chequeController';
import { processPayroll } from '../controllers/payrollController';
import { processS3Upload, getPresignedUrl, getPresignedDownloadUrl } from '../controllers/s3Controller';
import { authenticateToken, authenticateAdmin, authenticateMasterAdmin } from '../middlewares/authMiddleware';
import { getPeriods } from '../controllers/getPeriods';
import { createAdminController, deleteAdminController, listAdminsController } from '../controllers/masterAdminController';
import { ping } from '../controllers/ping';

const mainRouter = Router();

// Rota de ping para verificar se o servidor está online
mainRouter.get('/ping', ping);

// Rotas públicas
mainRouter.post('/login', login);

// Rotas de autenticação do usuário
mainRouter.use('/user', authenticateToken);
mainRouter.post('/user/update-password', updatePassword);

// Rotas protegidas por autenticação de admin
mainRouter.use('/admin', authenticateAdmin);

// Rotas que requerem admin master
mainRouter.post('/admin/create', authenticateMasterAdmin, createAdminController);
mainRouter.get('/admin/list', authenticateMasterAdmin, listAdminsController);
mainRouter.delete('/admin/:id', authenticateMasterAdmin, deleteAdminController);

// Rotas de contra-cheque (requer autenticação de usuário)
mainRouter.use('/contracheque', authenticateToken);
mainRouter.get('/contracheque/:userId/:year/:month', getContraCheque);
mainRouter.get('/periods/:userId', getPeriods);

// Rotas de upload e processamento (requer autenticação de admin)
mainRouter.use('/upload', authenticateAdmin);
mainRouter.post('/upload/payroll', processPayroll);
mainRouter.post('/upload/presigned-url', getPresignedUrl);
mainRouter.post('/upload/process-s3', processS3Upload);
mainRouter.post('/upload/download-url', getPresignedDownloadUrl);

export { mainRouter };


