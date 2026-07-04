import { getAdminAuth } from '../firebaseAdmin.mjs';

/**
 * Middleware: Verificar se usuário está autenticado (Firebase ID Token)
 * Extrai userId de request.auth.uid
 */
export async function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token não fornecido. Use: Authorization: Bearer <token>',
      });
    }

    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(token);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      isAdmin: decodedToken.isAdmin || false,
    };

    next();
  } catch (error) {
    console.error('❌ Auth error:', error.message);

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'Faça login novamente',
      });
    }

    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'Faça login novamente',
      });
    }

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Falha na autenticação',
    });
  }
}

/**
 * Middleware: Verificar se usuário é admin
 * Requer authMiddleware antes
 */
export async function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Autenticação necessária',
    });
  }

  // Verificar se usuário está na collection admins
  try {
    const { getAdminDb } = await import('../firebaseAdmin.mjs');
    const db = getAdminDb();

    const adminDoc = await db.collection('admins').doc(req.user.uid).get();

    if (!adminDoc.exists || !adminDoc.data().active) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Usuário não é admin ou foi desativado',
      });
    }

    req.admin = {
      ...req.user,
      role: adminDoc.data().role,
      active: adminDoc.data().active,
    };

    next();
  } catch (error) {
    console.error('❌ Admin middleware error:', error.message);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
}

/**
 * Middleware: Verificar se usuário é MASTER
 * Requer adminMiddleware antes
 */
export async function masterMiddleware(req, res, next) {
  if (!req.admin || req.admin.role !== 'MASTER') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Apenas MASTER admins podem acessar este recurso',
    });
  }

  next();
}
