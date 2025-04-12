import { Router } from 'express'
import { pingController } from '../controllers/ping'
import multer from 'multer';
import { loginUser, loginAdmin, updatePassword } from '../controllers/authController';
import { createAdminController, deleteAdminController, listAdminsController } from '../controllers/masterAdminController';
import { uploadPayroll } from '../controllers/payrollController';
import { authenticateAdmin } from '../middlewares/authMiddleware';
import { contra_chequeController } from '../controllers/contra_chequeController';
import { verifyToken } from '../utils/jwt';
import { getAvailablePeriods } from '../controllers/getPeriods';
import logger from '../utils/logger';


export const mainRouter = Router()

// Configuração avançada do multer para lidar com arquivos grandes
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 100 * 1024 * 1024 // Limite aumentado para 100MB
  },
  fileFilter: (req, file, cb) => {
    // Aceita apenas arquivos PDF
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(null, false);
      const err = new Error('Apenas arquivos PDF são permitidos!');
      err.name = 'ExtensionError';
      return cb(err as any);
    }
  }
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

//admin master
mainRouter.get('/master', authenticateAdmin, listAdminsController);
mainRouter.post('/master', authenticateAdmin, createAdminController);
mainRouter.delete('/master/:id', authenticateAdmin, deleteAdminController);