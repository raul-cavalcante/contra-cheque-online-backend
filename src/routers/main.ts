import { Router } from 'express'
import { pingController } from '../controllers/ping'
import multer from 'multer';
import { loginUser, loginAdmin } from '../controllers/authController';
import { createAdminController, deleteAdminController, listAdminsController } from '../controllers/masterAdminController';
import { uploadPayroll } from '../controllers/payrollController';
import { authenticateAdmin } from '../middlewares/authMiddleware';
import { contra_chequeController } from '../controllers/contra_chequeController';
import { verifyToken } from '../utils/jwt';

export const mainRouter = Router()

const upload = multer({ storage: multer.memoryStorage() });

mainRouter.get('/ping', pingController)

//Login do usuário
mainRouter.post('/login/user', loginUser);

mainRouter.get('/contra-cheques', verifyToken, contra_chequeController)

//Login do administrador/contador
mainRouter.post('/login/admin', loginAdmin);

//Upload de PDF/contra-cheques (requer autenticação de admin)
mainRouter.post('/upload/payroll', authenticateAdmin , upload.single('file'), uploadPayroll);

//admin master
mainRouter.get('/admins', authenticateAdmin , listAdminsController);
mainRouter.post('/admins', authenticateAdmin , createAdminController);
mainRouter.delete('/admins/:id', authenticateAdmin , deleteAdminController);