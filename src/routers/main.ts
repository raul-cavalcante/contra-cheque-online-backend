import { Router, Request, Response, NextFunction } from 'express'
import { pingController } from '../controllers/ping'
import multer, { MulterError } from 'multer';
import { loginUser, loginAdmin, updatePassword } from '../controllers/authController';
import { createAdminController, deleteAdminController, listAdminsController } from '../controllers/masterAdminController';
import { uploadPayroll } from '../controllers/payrollController';
import { authenticateAdmin } from '../middlewares/authMiddleware';
import { contra_chequeController } from '../controllers/contra_chequeController';
import { verifyToken } from '../utils/jwt';
import { getAvailablePeriods } from '../controllers/getPeriods';
import logger from '../utils/logger';
import config from '../config/config';

export const mainRouter = Router()

// Handler personalizado para erros do multer
const multerErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err) {
    logger.error('Erro no processamento do upload', {
      error: err.message,
      code: err.code,
      field: err.field,
      path: req.path,
      method: req.method
    });

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        error: 'Arquivo muito grande', 
        message: `O tamanho máximo permitido é ${config.upload.MAX_FILE_SIZE / (1024 * 1024)}MB`,
        maxSize: config.upload.MAX_FILE_SIZE
      });
    }

    if (err.name === 'ExtensionError') {
      return res.status(415).json({ 
        error: 'Tipo de arquivo não suportado', 
        message: 'Apenas arquivos PDF são permitidos',
        allowedTypes: config.upload.ALLOWED_MIME_TYPES
      });
    }

    return res.status(500).json({ 
      error: 'Erro no upload do arquivo', 
      message: err.message 
    });
  }
  
  next();
};

// Configuração avançada do multer para lidar com arquivos grandes
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: config.upload.MAX_FILE_SIZE // Limite aumentado para 100MB
  },
  fileFilter: (req, file, cb) => {
    logger.info('Verificando tipo de arquivo para upload', {
      mimetype: file.mimetype,
      filename: file.originalname,
      size: file.size
    });
    
    // Aceita apenas arquivos PDF
    if (file.mimetype === 'application/pdf') {
      logger.info('Arquivo PDF válido aceito', { filename: file.originalname });
      cb(null, true);
    } else {
      logger.warn('Arquivo rejeitado: tipo não suportado', { 
        mimetype: file.mimetype,
        filename: file.originalname
      });
      
      const err = new Error('Apenas arquivos PDF são permitidos!');
      err.name = 'ExtensionError';
      return cb(err as any);
    }
  }
});

// Rotas básicas
mainRouter.get('/ping', pingController);

// Login do usuário
mainRouter.post('/login/user', loginUser);
mainRouter.get('/contra-cheques', verifyToken, contra_chequeController);
mainRouter.get('/yearMonth', verifyToken, getAvailablePeriods);
mainRouter.put('/user', verifyToken, updatePassword);

// Login do administrador/contador
mainRouter.post('/login/admin', loginAdmin);

// Upload de PDF/contra-cheques (requer autenticação de admin)
mainRouter.post('/upload/payroll', 
  authenticateAdmin, 
  upload.single('file'), 
  multerErrorHandler,
  (req: Request, res: Response, next: NextFunction) => {
    // Middleware para verificar se o arquivo foi recebido antes de processar
    if (!req.file) {
      logger.warn('Nenhum arquivo enviado na requisição', {
        path: req.path,
        contentType: req.headers['content-type'],
        body: Object.keys(req.body)
      });
      return res.status(400).json({ error: 'Nenhum arquivo enviado. Verifique se o campo "file" está presente no formulário.' });
    }
    logger.info('Arquivo recebido com sucesso', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
    next();
  },
  uploadPayroll
);

// Admin master
mainRouter.get('/master', authenticateAdmin, listAdminsController);
mainRouter.post('/master', authenticateAdmin, createAdminController);
mainRouter.delete('/master/:id', authenticateAdmin, deleteAdminController);